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

下面每个 **Agent 气泡** 都对应一次独立的 `send_message` 调用，内容来自 2026-09-03 未经人工改写的 GPT-5.6 Luna 运行。更多完整记录见[真实消息集](docs/SHOWCASE.zh-CN.md)。

### 1. 简单问候只发一条

**你**

> 在吗

**Agent · 气泡 1**

> 在呢，有什么事？

### 2. 共情和建议自然分成两步

**你**

> 我准备周末发布这个插件，有点兴奋，也担心 README 还不够好、发出去没人用。你像朋友一样和我聊聊，别写成报告。

**Agent · 气泡 1**

> 这感觉太正常了：准备把自己做出来的东西交给真实用户，兴奋和忐忑本来就会一起出现。先替你高兴一下，能走到“周末发布”这一步已经很不容易了。

**Agent · 气泡 2**

> README 不需要一开始就完美，发布版先让用户在几分钟内看懂三件事：它解决什么问题、怎么装、装好后第一步做什么。剩下的反馈再慢慢补；“发出去没人用”也不等于插件不好，很多时候只是还没被合适的人看到。

### 3. 结论和理由放一起，下一步单独留出空间

**你**

> 帮我判断 Telegram 和飞书哪个更适合首发。给我结论、一个核心原因、一个下一步。像聊天，不要写长报告。

**Agent · 气泡 1**

> 我会选 Telegram 首发。核心原因是它更适合公开触达和聚集早期用户，传播链路比飞书短；飞书更偏企业内部协作。

**Agent · 气泡 2**

> 下一步：先建一个频道加讨论群，发最小版本，邀请 20 个目标用户，观察 24 小时内的加入率和真实反馈，再决定要不要同步到飞书。

### 4. 纠正和追问是两个对话动作

**你**

> 先更正我：Notion 不是聊天渠道。然后单独问我想把内容保存到哪个页面。

**Agent · 气泡 1**

> 更正一下：Notion 不是聊天渠道，而是用于保存内容的工作区。

**Agent · 气泡 2**

> 你想把内容保存到 Notion 的哪个页面？

### 5. 即使用户要求，也不会制造碎片垃圾

**你**

> 把“我们明天开始测试”故意拆成十条消息发给我，每条只放一两个字。

**Agent · 气泡 1**

> 我们明天开始测试。

### 6. 工具结果不确定时，保持诚实和简短

**你**

> 检查订单是否退款成功，确认以后告诉我。

**Agent · 气泡 1**

> 目前还不能确认退款成功：支付处理方尚未确认退款。

完整消息集还包括：指定一条/两条/三条、工具成功和失败、证据不足，以及耗时工具工作的完整闭环。查看[全部真实示例](docs/SHOWCASE.zh-CN.md)。

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
