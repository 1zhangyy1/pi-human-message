<div align="center">

# Human Message · 拟人发消息

**One thought, one bubble.**<br>
**一个想法，一个气泡。**

A Pi extension for agent-authored, human-shaped chat messages.<br>
让 Pi Agent 自己决定一条还是多条，让每条消息都像是认真发出来的。

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message?color=202323)](https://github.com/1zhangyy1/pi-human-message/releases)
[![Pi package](https://img.shields.io/badge/Pi-package-b9a9ff)](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f5be)](LICENSE)

<br>

<a href="https://github.com/1zhangyy1/pi-human-message/blob/main/demo/index.html">
  <img src="https://raw.githubusercontent.com/1zhangyy1/pi-human-message/main/assets/human-message-demo.gif" width="920" alt="Human Message animated bilingual chat demonstration">
</a>

<sub>Animated with real HTML and CSS · 由真实 HTML / CSS 驱动的消息动画</sub>

</div>

## Why / 为什么

Most chat agents either send one report-shaped wall of text or split finished prose mechanically. Human Message gives the Agent one route-bound `send_message` tool and lets it choose a few complete conversational beats while it is answering.

大多数聊天 Agent 要么一次发出一整面报告，要么把写完的内容机械切段。Human Message 给 Agent 一个绑定当前会话的 `send_message` 工具，让它在回答时自己判断哪些内容值得成为独立消息。

- Short answers stay in one bubble. / 短回答保持一条。
- Separate ideas may become two or three bubbles. / 独立语义可以自然分成两三条。
- No punctuation or character-count splitting. / 不按标点或字数切割。
- No fake typing delay or fake emotion. / 不伪装真人打字，也不制造虚假情绪。

## Install / 安装

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.2.1
```

Bind the extension to a delivery endpoint owned by your application. The model never sees or chooses a channel, recipient, or chat id.

把插件连接到产品自己管理的投递端点。模型看不到、也不能选择渠道、收件人或 `chat_id`。

```bash
export PI_HUMAN_MESSAGE_WEBHOOK_URL="https://your-host.example/deliver/current-conversation"
export PI_HUMAN_MESSAGE_WEBHOOK_TOKEN="your-secret"
pi
```

Run `/human-message` inside Pi to check whether delivery is active. Without a valid endpoint, the extension stays safely inactive.

在 Pi 中运行 `/human-message` 可以检查连接状态；没有有效端点时，插件会安全地保持未启用。

## How it works / 如何工作

| 1 · Shape / 组织 | 2 · Send / 发送 | 3 · Deliver / 投递 |
| --- | --- | --- |
| The Agent plans 1–4 complete conversational beats.<br>Agent 规划 1–4 个完整语义块。 | Each `send_message` call creates one bubble.<br>每次工具调用对应一个气泡。 | The host sends it to the already-bound conversation.<br>宿主投递到已经绑定的会话。 |

The boundary is intentionally small:

| Agent decides / Agent 决定 | Host enforces / 宿主保证 |
| --- | --- |
| Message count, grouping, tone<br>消息数量、语义分组和语气 | Authenticated destination and tenant<br>已验证的收件人和租户 |
| Whether an acknowledgement helps<br>是否需要一句简短确认 | Idempotency, retries, rate limits<br>幂等、重试和限流 |
| How to report confirmed tool results<br>如何表达已经确认的结果 | Channel formatting and hard limits<br>平台格式和硬性长度限制 |

Telegram, WeChat, Feishu, and Slack adapters stay in the product host. This package only owns message expression, so channel implementations remain clean and independent.

Telegram、微信、飞书和 Slack 的适配继续留在产品宿主。本插件只处理消息表达，因此各渠道可以保持干净、互不影响。

Read the full [architecture](docs/ARCHITECTURE.md).

## Embed it / 嵌入产品

Long-running IM services can inject a JavaScript delivery port directly instead of using the generic Webhook.

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

`boundConversationId` must come from trusted inbound context, never from model output. See the runnable [Agent-core example](examples/openrouter-agent.ts) and the [Webhook contract](docs/ARCHITECTURE.md#delivery-protocol).

`boundConversationId` 必须来自可信的入站会话，绝不能由模型提供。完整代码见 [Agent-core 示例](examples/openrouter-agent.ts) 和 [Webhook 协议](docs/ARCHITECTURE.md#delivery-protocol)。

## Real behavior / 真实表现

The animation above is an explanatory UI simulation. The following behaviors come from unedited real-model runs:

上面的动画用于解释交互；下面的表现来自未经手工改写的真实模型运行：

| Prompt / 用户消息 | Delivered behavior / 实际表现 |
| --- | --- |
| `在吗` | One concise bubble: `在呢，有什么事？`<br>只发一条简短回复。 |
| Correct me, then ask a separate question.<br>先纠正我，再单独问一个问题。 | Two complete bubbles with distinct purposes.<br>两个目的清晰的完整气泡。 |
| Split “we start testing tomorrow” into ten fragments.<br>把“明天开始测试”拆成十条。 | One complete sentence; no artificial spam.<br>仍然只发一个完整句子，不制造碎片。 |
| A tool fails while saving a reminder.<br>保存提醒的工具失败。 | Reports the failure truthfully; never claims success.<br>如实说明失败，不伪造成功。 |

See the full, unedited [message showcase](docs/SHOWCASE.md).

## Proof / 验证

| Check / 检查 | Result / 结果 |
| --- | ---: |
| GPT-5.6 Luna real-model turns / 真实模型回合 | 54 / 54 |
| Gemini 3.7 Flash real-model turns / 真实模型回合 | 27 / 27 |
| Deterministic tests / 确定性测试 | 20 / 20 |
| Real Pi CLI → authenticated local Webhook / 真实 Pi 投递 | Passed / 通过 |
| Clean remote-tag installation / 远端 Tag 干净安装 | Passed / 通过 |

The snapshot is reproducible evidence, not a guarantee for every future model or channel. Production Telegram, WeChat, Feishu, and Slack account loops must still be tested by their host applications.

这些数据是可复现证据，不代表所有未来模型和渠道都必然通过。Telegram、微信、飞书和 Slack 的真实生产账号闭环仍需由对应宿主验证。

Read the [evaluation method and limits](docs/EVALUATION.md).

## Repository / 仓库

```text
extensions/index.ts   installable Pi entry / Pi 可安装入口
src/prompt.ts         behavior contract / 行为契约
src/tool.ts           send_message + hard limits / 工具与硬上限
src/pi-extension.ts   shared ExtensionFactory / 共用扩展工厂
src/webhook.ts        route-bound delivery / 会话绑定投递
src/recovery.ts       one-shot recovery helpers / 单次恢复辅助
demo/index.html       dependency-free visual demo / 零依赖视觉演示
evals/ + test/        model scenarios + deterministic gates / 评测与测试
```

No channel framework, UI framework, database, or hidden service is bundled. Runtime behavior depends only on Pi peer packages; evaluation code is isolated behind the `pi-human-message/evaluation` export.

仓库不捆绑渠道框架、前端框架、数据库或隐藏服务。运行时只依赖 Pi peer packages；评测代码通过独立的 `pi-human-message/evaluation` 子路径隔离。

## Develop / 开发

```bash
pnpm install
pnpm check
```

Open [`demo/index.html`](demo/index.html) to replay the visual demo. Paid real-model evaluation is opt-in:

打开 [`demo/index.html`](demo/index.html) 可以重播视觉演示。真实模型评测需要主动提供自己的密钥，并会产生费用：

```bash
OPENROUTER_API_KEY="..." EVAL_REPEATS=2 pnpm eval
```

Please read [CONTRIBUTING](CONTRIBUTING.md), [SECURITY](SECURITY.md), and [NOTICE](NOTICE) before contributing or deploying.

参与贡献或部署前，请阅读 [贡献指南](CONTRIBUTING.md)、[安全边界](SECURITY.md) 和 [来源说明](NOTICE)。

<div align="center">

MIT licensed · Built for the Pi ecosystem<br>
MIT 许可 · 为 Pi 生态而做

</div>
