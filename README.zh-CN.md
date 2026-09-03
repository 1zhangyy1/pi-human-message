<div align="center">

# Human Message · 拟人发消息

**一个对话动作，一个气泡。**

让 Pi Agent 自己把回复组织成一条或几条自然聊天消息。

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message?color=202323)](https://github.com/1zhangyy1/pi-human-message/releases)
[![Pi package](https://img.shields.io/badge/Pi-package-b9a9ff)](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f5be)](LICENSE)

<br>

<a href="https://github.com/1zhangyy1/pi-human-message/blob/main/demo/index.html">
  <img src="https://raw.githubusercontent.com/1zhangyy1/pi-human-message/main/assets/human-message-demo.gif" width="920" alt="Human Message 拟人发消息动画演示">
</a>

<sub>零依赖 HTML / CSS 动画。下方真实模型记录是独立的验证证据。</sub>

</div>

## 它改变了什么

大多数聊天 Agent 要么一次发出一整面报告，要么把写完的内容机械切段。Human Message 给 Agent 一个绑定当前会话的 `send_message` 工具，让它在生成答案时自己判断消息边界。

- 短回答保持一条。
- 对话目的发生变化时，可以自然开启下一条。
- 服务于同一目的的相关句子留在一起。
- 标点、换行和字数本身不会触发拆分。
- 不模拟打字延迟，也不假装真人。

## 直接看效果

下面每个 **Agent 气泡** 都对应一次独立的 `send_message` 调用，结构和内容来自真实 GPT-5.6 Luna 运行；首页为控制篇幅做了少量节选，完整原文见[真实消息集](docs/SHOWCASE.zh-CN.md)。

### 1. 简单问候只发一条

**你**

> 在吗

**Agent · 气泡 1**

> 在呢，有什么事？

### 2. 共情和建议自然分成两步

**你**

> 我周末想把这个插件发出去，但越看 README 越觉得哪都不对，有点不敢发了。

**Agent · 气泡 1**

> 这种临近发布、反复看 README 越看越不放心的感觉很正常，不代表插件真的有问题，更多时候是你已经盯太久了。先别在“完美”这个标准上卡住。

**Agent · 气泡 2**

> 我们可以把它当成一次发布前检查：先只看安装方式、功能说明、示例、限制/已知问题和许可证这几项，其他措辞和排版先不管。

### 3. 一个正常的两连问，得到两个有用回答

**你**

> 我想先把 Telegram 做好再接飞书，这个顺序靠谱吗？我现在最该先验证什么？

**Agent · 气泡 1**

> 这个顺序靠谱，而且通常更稳：先把 Telegram 做成一个闭环，再接飞书。前提是先把“渠道无关”的核心逻辑抽出来，别把业务规则全写死在 Telegram Bot 里。

**Agent · 气泡 2**

> 现在最该验证一条最小闭环：用户发来真实消息 → 系统识别用户和会话 → 调用核心能力 → 在合理时间内回复，同时保证消息不丢失、不重复、不串会话。

### 4. 快速工具在后台安静完成，再告诉你结果

**你**

> 帮我记一下：下周一上午十点和小周开会。

*后台动作 · 用户聊天中不可见：`save_note` 成功*

**Agent · 气泡 1**

> 记好了：下周一上午十点和小周开会。

### 5. 查询结果不确定，就如实说不确定

**你**

> 你帮我看看上周那笔退款到账了吗？

*后台动作 · 用户聊天中不可见：`check_refund` 返回不确定*

**Agent · 气泡 1**

> 目前还不能确认到账：支付处理方尚未确认这笔退款。

### 6. 耗时工作先自然回应，做完再交付

**你**

> 你帮我查查 Telegram 和飞书哪个更适合我们先上线，给我一个明确建议。

**Agent · 气泡 1**

> 我先查一下两边当前的产品能力、合规与上线门槛，再给你一个明确的先上线建议。

*后台动作 · 用户聊天中不可见：`research_channels` 执行*

**Agent · 气泡 2**

> 明确建议：如果第一阶段是面向外部用户、做早期增长或社区运营，先上 Telegram；后续再接飞书，用于组织内部协作和流程承接。

**Agent · 气泡 3**

> 但如果第一阶段就是服务中国企业内部，核心是审批、文档、群协作和管理员管控，那应反过来先上飞书。这次工具返回的证据较概括，价格和合规细节还需要继续核实。

更多自然对话和单独归类的可靠性测试，见[完整真实消息集](docs/SHOWCASE.zh-CN.md)。

## 聊天背后发生了什么

```text
快速动作    你 →〔后台调用工具〕→ 结果气泡
耗时工作    你 → 简短确认 →〔后台调用工具〕→ 结果气泡
```

最终用户的聊天里只应该出现成功投递的 `send_message`。Pi 终端仍可能展示给开发者看的工具轨迹；产品宿主必须只渲染确认后的消息投递流，不能把普通 assistant 文本或工具事件直接暴露给用户。

## 工作原理

| 1 · 组织 | 2 · 发送 | 3 · 投递 |
| --- | --- | --- |
| Agent 规划 1–4 个完整对话动作。 | 每次 `send_message` 调用生成一个气泡。 | 宿主把消息投递到已经绑定的会话。 |

边界刻意保持很小：

| Agent 决定 | 宿主保证 |
| --- | --- |
| 消息数量、语义分组和语气 | 已验证的收件人和租户 |
| 是否需要一句简短确认 | 幂等、重试和限流 |
| 如何表达已经确认的工具结果 | 渠道格式和硬性长度限制 |

Telegram、微信、飞书和 Slack 的适配继续留在产品宿主。本插件只负责消息表达，因此各渠道可以保持干净、互不影响。

阅读完整[架构说明](docs/ARCHITECTURE.md)。

## 安装

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.2.2
```

把插件连接到产品自己管理的投递端点。模型看不到、也不能选择渠道、收件人或 `chat_id`。

```bash
export PI_HUMAN_MESSAGE_WEBHOOK_URL="https://your-host.example/deliver/current-conversation"
export PI_HUMAN_MESSAGE_WEBHOOK_TOKEN="your-secret"
pi
```

在 Pi 中运行 `/human-message` 可以检查连接状态。没有有效端点时，插件会安全地保持未启用。

## 嵌入产品

常驻的 IM 服务可以直接注入 JavaScript 投递端口，不需要绕一层通用 Webhook。

```ts
import { createHumanMessageExtension } from "pi-human-message";

const humanMessage = createHumanMessageExtension({
  send: async ({ toolCallId, text }) => {
    const sent = await channel.send(boundConversationId, text);
    return {
      messageId: toolCallId,
      externalMessageIds: [String(sent.id)],
      idempotentReplay: false,
    };
  },
});
```

`boundConversationId` 必须来自可信的入站会话，绝不能由模型提供。完整代码见 [Agent-core 示例](examples/openrouter-agent.ts) 和 [Webhook 协议](docs/ARCHITECTURE.md#delivery-protocol)。

## 验证证据

| 检查 | 结果 |
| --- | ---: |
| GPT-5.6 Luna 当前提示词真实回合 | 56 / 56 |
| 自主语义分条回合 | 8 / 8 |
| 短消息抗碎片回合 | 24 / 24 |
| 确定性测试 | 20 / 20 |
| 真实 Pi CLI → 本地鉴权 Webhook | 通过 |
| 从远端 Tag 干净安装 | 通过 |

这些数据是可复现证据，不代表所有未来模型和渠道都必然通过。Telegram、微信、飞书和 Slack 的真实生产账号闭环仍需由对应宿主单独验证。

阅读[评测方法与边界](docs/EVALUATION.md)。

## 仓库结构

```text
extensions/index.ts   Pi 可安装入口
src/prompt.ts         行为契约与每轮提醒
src/tool.ts           send_message 与硬上限
src/pi-extension.ts   共用 ExtensionFactory
src/webhook.ts        会话绑定投递
src/recovery.ts       单次恢复辅助
demo/index.html       零依赖视觉演示
evals/ + test/        模型评测与确定性检查
```

仓库不捆绑渠道框架、前端框架、数据库或隐藏服务。运行时只依赖 Pi peer packages；评测代码通过独立的 `pi-human-message/evaluation` 子路径隔离。

## 开发

```bash
pnpm install
pnpm check
```

打开 [`demo/index.html`](demo/index.html) 可以重播视觉演示。真实模型评测需要主动提供自己的密钥，并会产生费用：

```bash
OPENROUTER_API_KEY="..." EVAL_REPEATS=2 pnpm eval
```

参与贡献或部署前，请阅读 [贡献指南](CONTRIBUTING.md)、[安全边界](SECURITY.md) 和 [来源说明](NOTICE)。

<div align="center">

MIT 许可 · 为 Pi 生态而做

</div>
