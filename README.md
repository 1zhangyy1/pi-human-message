# 拟人发消息 / Human Message

**A real Pi extension that lets the Agent decide when one thought deserves one chat bubble.**

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message)](https://github.com/1zhangyy1/pi-human-message/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-202124.svg)](LICENSE)

让 Pi Agent 自己判断这次回复应该是一条还是几条消息。它不按标点机械拆句，不用延迟伪装人类打字，也不在模型不知情时二次切割已完成的回答。

## 先看真实效果

2026-09-02 的真实冒烟测试：Pi CLI `0.84.4` 加载本扩展，GPT-5.6 Luna 通过本地 Webhook 实际投递。下面三条未经手工改写。

**User**

> 请像聊天一样分三条告诉我：你理解了什么、一个风险、再问我一个问题。主题是把这个 Pi 插件开源。

**Agent 真正发出的 3 个气泡**

> 🟣 我理解的是：你想把当前这个 Pi 插件整理成一个适合公开发布的开源项目，包括代码、文档、许可证，以及必要的配置和示例。

> 🟣 一个风险是：插件里可能还包含个人路径、密钥、聊天记录或其他环境相关信息；如果直接发布，容易造成隐私泄露或让别人无法复现。

> 🟣 你希望开源到哪个平台，以及倾向使用什么许可证（例如 MIT、Apache-2.0 或 GPL）？

这不是 token streaming；是 Agent 在生成时主动调用了三次 `send_message`，每次都是一个完整语义单元。这里的“用户可见”指目标聊天渠道；Pi 终端仍是操作者界面。更多真实样例见 [Showcase](docs/SHOWCASE.md)。

## 它到底是什么

**是 Pi 插件。** 更准确地说，这是一个符合 Pi package 规范的包，里面有一个默认导出的 Pi Extension。

- `package.json` 通过 `pi.extensions` 声明可发现入口。
- [`extensions/index.ts`](extensions/index.ts) 是 `pi install` 加载的默认扩展。
- [`createHumanMessageExtension()`](src/pi-extension.ts) 是给产品 SDK 宿主使用的同一个 `ExtensionFactory`。
- 两种入口共用同一套 prompt、tool、消息上限和投递协议。

**但它不是通道 SDK。** Telegram、微信、飞书或 Slack 仍由应用负责登录、路由、限流、格式和重试。本插件只决定“说什么、用几条说”，再把文本交给已绑定当前会话的发送端口。

## 怎么工作

```text
用户消息
   ↓
Pi Agent + Human Message 行为契约
   ↓  Agent 先规划 1–4 个完整语义块
send_message({ text })
   ↓  模型看不到 channel / recipient / chat_id
宿主绑定的发送端口
   ├─ Telegram
   ├─ 微信
   ├─ 飞书 / Slack
   └─ 任意 IM
```

默认行为：

- 普通短答优先一条。
- 只有真正存在独立对话节拍时才发两到三条。
- 详细回答先按语义组织，不在生成后按字数切片。
- 每轮硬上限四条，单条默认软上限约 700 字符。
- 工具成功、失败和不确定结果都必须如实收尾。
- 产品宿主可在 Agent 忘记投递时执行最多一次恢复。

详细设计见 [Architecture](docs/ARCHITECTURE.md)。

## 方式一：作为 Pi package 安装

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.2.0
```

安装入口使用一个通用、已绑定路由的 Webhook：

```bash
export PI_HUMAN_MESSAGE_WEBHOOK_URL="https://your-host.example/deliver/current-conversation"
export PI_HUMAN_MESSAGE_WEBHOOK_TOKEN="your-secret"
pi
```

在 Pi 内输入 `/human-message` 可查看 active/inactive 状态。未配置 Webhook 时扩展保持 inactive，不会注册一个永远失败的工具。

Webhook 接收：

```json
{
  "version": "pi-human-message.delivery.v1",
  "toolCallId": "tool-call-id",
  "text": "one complete chat bubble"
}
```

并返回投递回执：

```json
{
  "messageId": "host-stable-id",
  "externalMessageIds": ["telegram-message-id"],
  "idempotentReplay": false
}
```

`toolCallId` 同时作为 `Idempotency-Key` header。远程端点必须使用 HTTPS，只有 localhost 可使用 HTTP。

## 两分钟本地体验

第一个终端：

```bash
git clone https://github.com/1zhangyy1/pi-human-message.git
cd pi-human-message
corepack enable
pnpm install
export PI_HUMAN_MESSAGE_WEBHOOK_TOKEN="local-demo"
pnpm example:webhook
```

第二个终端，使用你已配置好模型的 Pi：

```bash
export PI_HUMAN_MESSAGE_WEBHOOK_URL="http://127.0.0.1:8789/deliver"
export PI_HUMAN_MESSAGE_WEBHOOK_TOKEN="local-demo"
pnpm exec pi -e ./extensions/index.ts "请分三条告诉我：你理解了什么、一个风险、再问我一个问题。"
```

第一个终端会显示 Agent 真正投递的独立气泡。它用 `toolCallId` 演示最小幂等处理，但数据只存在内存；这个 demo server 只用于本地观察，不是生产消息队列。

## 方式二：嵌入你的 Pi 产品

对 Telegram、微信、飞书等长驻服务，直接注入 JS 发送端口，不必绕 Webhook：

```bash
pnpm add https://github.com/1zhangyy1/pi-human-message/releases/download/v0.2.0/pi-human-message-0.2.0.tgz
```

```ts
import { DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
import { createHumanMessageExtension } from "pi-human-message";

const humanMessage = createHumanMessageExtension({
  send: async ({ toolCallId, text }) => {
    const sent = await telegram.sendMessage(boundChatId, text);
    return {
      messageId: toolCallId,
      externalMessageIds: [String(sent.message_id)],
      idempotentReplay: false,
    };
  },
});

const resourceLoader = new DefaultResourceLoader({
  extensionFactories: [{ name: "human-message", factory: humanMessage }],
});
await resourceLoader.reload();
```

`boundChatId` 必须来自已验证的入站会话，绝不能让模型提供。完整 Agent-core 示例见 [`examples/openrouter-agent.ts`](examples/openrouter-agent.ts)。

## 仓库设计

```text
extensions/index.ts      Pi package 可发现入口，只处理配置和组装
src/prompt.ts            对话形状与真实性契约
src/tool.ts              send_message 工具和每轮硬上限
src/pi-extension.ts      标准 Pi ExtensionFactory
src/webhook.ts           可安装 package 的通用发送端口
src/recovery.ts          宿主可选的一次恢复检测
src/evaluation.ts        评测子路径，不混入默认运行 API
evals/                   27 个真实模型行为场景
test/                    确定性边界和 package 发现测试
```

依赖只能向内：入口和端口依赖行为内核，行为内核不知道 Telegram、微信或任何产品业务。

## 谁决定什么

| Agent 决定 | 宿主强制 |
| --- | --- |
| 一条还是多条 | 最多 1–8 条，默认 4 |
| 语义分组和语气 | 单条平台硬上限 |
| 是否需要短确认 | 已验证的当前收件人 |
| 如何报告工具结果 | 授权、幂等、限流和重试 |

这就是为什么仓库里没有一堆 channel adapter：消息表达判断应该共享，平台运营细节应该彼此隔离。

## 验证状态

- GPT-5.6 Luna：54/54 个独立回合通过，52/54 直接投递，2 个经一次恢复投递。
- Gemini 3.7 Flash：27/27 通过，全部直接投递。
- 合计真实模型回合：81/81 在发布门槛内通过。
- 确定性测试：20 个，覆盖 prompt、tool、恢复、Webhook、package manifest 和安全失败。
- 真实 Pi CLI 扩展冒烟：已加载 `extensions/index.ts` 并向本地 Webhook 投递 3 条气泡。

这些数字是可复现快照，不是对任意未来模型的保证。场景、命令和局限见 [Evaluation](docs/EVALUATION.md)。

## 公共 API

- `createHumanMessageExtension(options)`
- `createHumanMessageSystemPrompt(options)`
- `withHumanMessageTurnReminder(text)`
- `createSendMessageAgentTool(send, options)`
- `createTurnBoundSendMessagePort(send, options)`
- `createWebhookSendMessagePort(options)`
- `inspectHumanMessageDelivery(trace)`
- `createHumanMessageRecoveryPrompt(state)`
- `pi-human-message/evaluation` 评测子路径

## 明确的局限

- 当前只投递文本，不处理图片、文件、reaction 或 typing indicator。
- 不提供 Telegram/微信/飞书 SDK，不管理登录和入站 webhook。
- 可安装的 Webhook 入口不会自动运行恢复 Agent；需要可持久轮次 ID 的产品宿主应使用 recovery API 执行最多一次恢复。
- Prompt 是行为引导，不是权限或租户隔离边界。
- 本轮验证了库、Pi package、本地 Webhook 和真实模型，没有把本地 demo 当作真实 Telegram/微信/飞书生产闭环。

安全边界见 [SECURITY.md](SECURITY.md)。

## 开发

```bash
pnpm install
pnpm check
```

真实模型评测是 opt-in 且会产生费用：

```bash
export OPENROUTER_API_KEY="..."
EVAL_REPEATS=2 pnpm eval
```

CI 不使用密钥，只运行类型检查、确定性测试、构建和 package 审计。行为改动请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 来源与许可

设计复用了 Pi 的 ExtensionFactory、工具注册和每轮 system prompt 机制。可安装 package 的结构遵循 Pi 官方 [packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md) 和 [extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md) 规范。

评测中的对照 prompt 参考了 MIT 许可的 [`artickc/grok-telegram-bot`](https://github.com/artickc/grok-telegram-bot) 和 [`yuanyijie/learn-grok-bot`](https://github.com/yuanyijie/learn-grok-bot)。本项目不隶属于 xAI、Telegram 或 Pi 维护者，也不声称拥有 xAI 的私有生产 prompt。详见 [NOTICE](NOTICE)。

MIT licensed.
