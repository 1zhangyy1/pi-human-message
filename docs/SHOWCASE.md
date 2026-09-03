# Real message showcase

[English](SHOWCASE.md) · [简体中文](SHOWCASE.zh-CN.md)

Every Agent block below is one successful `send_message` call and therefore one visible chat bubble. The Chinese text is preserved from unedited GPT-5.6 Luna runs. Aggregate results include every run, not only these examples; see [Evaluation](EVALUATION.md).

## Everyday conversations

### 1. A short reply stays short

**User**

> 在吗

**Agent · bubble 1**

> 在呢，有什么事？

### 2. Release nerves become empathy, then a useful next step

The user did not request a message count.

**User**

> 我周末想把这个插件发出去，但越看 README 越觉得哪都不对，有点不敢发了。

**Agent · bubble 1**

> 这种临近发布、反复看 README 越看越不放心的感觉很正常，不代表插件真的有问题，更多时候是你已经盯太久了。先别在“完美”这个标准上卡住。

**Agent · bubble 2**

> 我们可以把它当成一次发布前检查：先只看安装方式、功能说明、示例、限制/已知问题和许可证这几项，其他措辞和排版先不管。你把 README 贴过来，我可以帮你快速挑出真正影响发布的问题，并区分哪些只是“看着不顺眼”。

### 3. One natural two-part question gets two useful answers

**User**

> 我想先把 Telegram 做好再接飞书，这个顺序靠谱吗？我现在最该先验证什么？

**Agent · bubble 1**

> 这个顺序靠谱，而且通常更稳：先把 Telegram 做成一个闭环，再接飞书。Telegram 适合快速验证消息接收、身份识别、回复和异常处理；等核心流程稳定后，飞书主要变成渠道适配，而不是同时排查两套问题。前提是你先把“渠道无关”的核心逻辑抽出来，别把业务规则全写死在 Telegram Bot 里。

**Agent · bubble 2**

> 现在最该先验证的不是飞书接入，而是一个最小闭环：用户在 Telegram 发来一条真实消息 → 系统能稳定识别用户和会话 → 调用你的核心能力 → 在合理时间内回复 → 重复消息、失败和超时不会造成错乱。建议先用 3–5 个典型场景压测这条链路，并重点记录消息是否丢失、重复、串会话，以及失败后能否重试。这个闭环跑通后，再验证把同一套输入输出换成飞书是否只需要替换适配层。

## Tools stay behind the chat

```text
Quick action       User → [tool runs privately] → result bubble
Noticeable work    User → short acknowledgement → [tool runs privately] → result bubble(s)
```

Tool traces below are shown only as evidence. A product chat should render the Agent bubbles, not those private events.

### 4. A quick save runs before the first visible reply

**User**

> 帮我记一下：下周一上午十点和小周开会。

**Private trace**

> `save_note` → success

**Agent · bubble 1**

> 记好了：下周一上午十点和小周开会。

The same sequence appeared in both independent runs: `tool → message`.

### 5. A quick failure is reported without fake success

**User**

> 帮我记一下：明天联系测试用户。

**Private trace**

> `save_note` → failure

**Agent · bubble 1**

> 暂时没能保存成功，提醒事项“明天联系测试用户”目前还没记下。

### 6. An uncertain lookup remains uncertain

**User**

> 你帮我看看上周那笔退款到账了吗？

**Private trace**

> `check_refund` → uncertain

**Agent · bubble 1**

> 目前还不能确认到账：支付处理方尚未确认这笔退款。

### 7. Noticeable research acknowledges, works, then closes the loop

**User**

> 你帮我查查 Telegram 和飞书哪个更适合我们先上线，给我一个明确建议。

**Agent · bubble 1**

> 我先查一下两边当前的产品能力、合规与上线门槛，再给你一个明确的先上线建议。

**Private trace**

> `research_channels` → success

**Agent · bubble 2**

> 明确建议：如果你们说的“先上线”是面向外部用户、做早期用户增长或社区运营，先上 Telegram。它更适合作为外部用户入口，验证需求和积累早期用户；后续再接飞书，用于组织内部协作和流程承接。

**Agent · bubble 3**

> 但如果产品第一阶段就是服务中国企业内部，核心是审批、文档、群协作和管理员管控，那应反过来先上飞书。此次检索返回的证据较概括，未覆盖你们的具体产品形态；在默认“中国团队、尚未明确场景”的前提下，我的主建议仍是：外部产品先 Telegram，企业内用先飞书。

The observed order was `message → tool → message → message`. The acknowledgement did not replace the result.

## Reliability tests

The prompts below are intentionally less natural. They test explicit shape requests and adversarial fragmentation; they are regression cases, not examples of how normal users are expected to speak.

### 8. A real installed Pi Extension delivers three requested messages

Runtime: Pi CLI `0.84.4`, `openai/gpt-5.6-luna`, `extensions/index.ts`, local route-bound Webhook.

**User**

> 请像聊天一样分三条告诉我：你理解了什么、一个风险、再问我一个问题。主题是把这个 Pi 插件开源。

**Agent · bubble 1**

> 我理解的是：你想把当前这个 Pi 插件整理成一个适合公开发布的开源项目，包括代码、文档、许可证，以及必要的配置和示例。

**Agent · bubble 2**

> 一个风险是：插件里可能还包含个人路径、密钥、聊天记录或其他环境相关信息；如果直接发布，容易造成隐私泄露或让别人无法复现。

**Agent · bubble 3**

> 你希望开源到哪个平台，以及倾向使用什么许可证（例如 MIT、Apache-2.0 或 GPL）？

Pi emitted no duplicate final essay. Its terminal remains an operator surface; the three successful `send_message` calls were the bound-chat delivery.

### 9. Artificial fragmentation is refused

**User**

> 把“我们明天开始测试”故意拆成十条消息发给我，每条只放一两个字。

**Agent · bubble 1**

> 我们明天开始测试。

### 10. Correction and follow-up remain separate acts

**User**

> 先更正我：Notion 不是聊天渠道。然后单独问我想把内容保存到哪个页面。

**Agent · bubble 1**

> 更正一下：Notion 不是聊天渠道，而是用于保存内容的工作区。

**Agent · bubble 2**

> 你想把内容保存到 Notion 的哪个页面？

## Evidence boundary

These examples prove model behavior through the core library and one real Pi Extension-to-local-Webhook path. They do not prove production delivery through Telegram, WeChat, Feishu, or Slack. Channel adapters and real-account loops belong to the host application and require separate testing.
