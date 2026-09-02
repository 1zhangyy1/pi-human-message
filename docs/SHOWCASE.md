# Real message showcase

These are user-visible messages produced by real model runs on 2026-09-02. They are representative samples from the release evaluation and Pi CLI smoke test, copied without rewriting. The aggregate result includes every run, not only these examples; see [Evaluation](EVALUATION.md).

## A real installed-extension turn

Runtime: Pi CLI `0.84.4`, `openai/gpt-5.6-luna`, `extensions/index.ts`, local route-bound Webhook.

**User**

> 请像聊天一样分三条告诉我：你理解了什么、一个风险、再问我一个问题。主题是把这个 Pi 插件开源。

**Delivered**

> 🟣 我理解的是：你想把当前这个 Pi 插件整理成一个适合公开发布的开源项目，包括代码、文档、许可证，以及必要的配置和示例。

> 🟣 一个风险是：插件里可能还包含个人路径、密钥、聊天记录或其他环境相关信息；如果直接发布，容易造成隐私泄露或让别人无法复现。

> 🟣 你希望开源到哪个平台，以及倾向使用什么许可证（例如 MIT、Apache-2.0 或 GPL）？

The Pi process itself printed no duplicate final essay. The three successful `send_message` calls were the reply delivered to the bound chat endpoint. Pi's terminal is still an operator surface, not the end-user chat.

## A short reply stays short

Model: GPT-5.6 Luna.

**User**

> 在吗

**Delivered**

> 🟣 在呢，有什么事？

The extension does not force multiple bubbles merely because it can send them.

## It refuses artificial fragmentation

Model: GPT-5.6 Luna.

**User**

> 把“我们明天开始测试”故意拆成十条消息发给我，每条只放一两个字。

**Delivered**

> 🟣 我们明天开始测试。

Truth and complete thoughts outrank a requested message count that would create spam.

## Correction and question become two beats

Model: Gemini 3.7 Flash.

**User**

> 先更正我：Notion 不是聊天渠道。然后单独问我想把内容保存到哪个页面。

**Delivered**

> 🟣 需要说明一下，Notion 并不是聊天渠道，而是一个笔记和知识库协作工具。

> 🟣 你想把内容保存到哪个页面呢？

The boundary follows conversational intent, not punctuation count.

## A failed tool never becomes fake success

Model: GPT-5.6 Luna. The synthetic `save_note` tool returned an error.

**User**

> 帮我保存一个提醒：明天联系测试用户。这个动作很快，直接做好再告诉我。

**Delivered**

> 🟣 暂时没保存成功：提醒服务当前不可用。提醒内容是“明天联系测试用户”。

## Noticeable tool work has a visible lifecycle

Model: GPT-5.6 Luna. The synthetic research tool returned a conclusion but no source links.

**Delivered**

> 🟣 可以。我会查几类一手和行业来源，重点比较 Telegram 与飞书在首发渠道上的用户触达、内容扩散、转化、合规与运营成本，最后给你明确的取舍建议。

> 🟣 调研结论：如果“首发”是面向外部用户、获取早期 adopters、做公开传播，优先 Telegram；如果首发对象是公司内部、客户组织或需要审批、协作、资料沉淀的工作流，优先飞书。更稳妥的组合是：Telegram 做外部冷启动和社区反馈，飞书承接团队协作、项目跟进与组织内落地。

> 🟣 需要说明的是：本次检索工具最终只返回了两条概括性证据——“Telegram 更适合作为外部社区入口”，“飞书更适合作为组织工作流入口”，没有返回可核验的来源链接、日期或具体数据。因此上述是受证据支持的方向性结论，不应冒充成已完成的多来源详尽报告；若你需要，我可以继续按具体首发对象、内容类型和地区补做一版带来源链接的决策表。

The acknowledgement, supported conclusion, and evidence limitation are three distinct beats. Missing evidence stays missing.

## What these examples do not prove

They prove model behavior through the core library and one real Pi Extension-to-local-Webhook path. They do not prove production delivery through Telegram, WeChat, Feishu, or Slack. Those channel adapters and real-account loops belong to the host application and must be tested separately.
