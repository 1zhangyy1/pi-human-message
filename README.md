# 拟人发消息 / pi-human-message

Let a Pi Agent decide when one thought deserves one chat bubble.

`pi-human-message` is a small, runtime-neutral messaging behavior layer for embedded [Pi](https://github.com/earendil-works/pi) agents. It gives the Agent one host-bound `send_message` tool, a clear conversational contract, a per-turn delivery guard, and one-shot recovery when the Agent forgets to make its answer visible.

It is about **message boundaries**, not token streaming. It does not split finished prose by punctuation or character count, imitate typing delays, or pretend the Agent is human.

## What it changes

Without a delivery contract, an IM Agent often does one of two awkward things:

- emits a single report-shaped wall of text; or
- streams/splits fragments that were never meaningful messages on their own.

This package asks the model to plan a small number of complete conversational beats before sending. A concise answer stays one bubble. A detailed explanation may become a few coherent bubbles. Tool work closes with a confirmed result, question, or honest blocker.

The host remains responsible for routing and delivery:

```text
user turn
   ↓
Pi Agent + human-message contract
   ↓ chooses 1–4 semantic messages
send_message (no recipient argument)
   ↓
host delivery port
   ├─ Telegram
   ├─ WeChat
   └─ Feishu / Slack / any IM
```

The model never chooses a channel or recipient. Your application binds those from the inbound conversation.

## Status

This is an early `0.1.0` release for embedded Pi agents. The public API is intentionally small, but minor releases may still refine names and prompt behavior.

The final pre-release suite ran 81 independent real-model turns across 27 scenarios:

- GPT-5.6 Luna: 54/54 passed after at most one recovery; 52/54 delivered directly.
- Gemini 3.7 Flash: 27/27 passed; 27/27 delivered directly.
- deterministic unit tests: 14/14 passed.

These results are a reproducible snapshot, not a universal model guarantee. See [Evaluation](docs/EVALUATION.md) for scenarios, commands, metrics, and limitations.

## Install

Until an npm release exists, install from GitHub with the Pi peer dependencies used by your host:

```bash
pnpm add github:1zhangyy1/pi-human-message \
  @earendil-works/pi-agent-core \
  @earendil-works/pi-ai
```

Node.js 22.19 or newer is required, matching current Pi packages.

## Quick start: embedded Agent

The full runnable OpenRouter example is in [`examples/openrouter-agent.ts`](examples/openrouter-agent.ts). The essential integration is:

```ts
import { Agent } from "@earendil-works/pi-agent-core";
import {
  createHumanMessageSystemPrompt,
  createSendMessageAgentTool,
  createTurnBoundSendMessagePort,
  inspectHumanMessageDelivery,
  createHumanMessageRecoveryPrompt,
  withHumanMessageTurnReminder,
  type HumanMessageTraceEvent,
} from "pi-human-message";

const trace: HumanMessageTraceEvent[] = [];

// Capture chatId from trusted inbound context; never let the model supply it.
const delivery = createTurnBoundSendMessagePort(async ({ toolCallId, text }) => {
  const platformMessage = await telegram.sendMessage(chatId, text);
  trace.push({ type: "message", text });
  return {
    messageId: toolCallId, // use a durable host id in production
    externalMessageIds: [String(platformMessage.message_id)],
    idempotentReplay: false,
  };
});

const sendMessage = createSendMessageAgentTool(delivery.send);

const agent = new Agent({
  initialState: {
    systemPrompt: createHumanMessageSystemPrompt(),
    model,
    tools: [sendMessage, ...yourTools],
    messages: [],
    thinkingLevel: "medium",
  },
  streamFn,
  getApiKey,
  toolExecution: "sequential",
});

delivery.reset();
await agent.prompt(withHumanMessageTurnReminder(userText));

// Record your other tool calls in `trace`, then inspect once at turn end.
const state = inspectHumanMessageDelivery(trace);
if (state.needsRecovery) {
  await agent.prompt(createHumanMessageRecoveryPrompt({
    toolWorkAfterLastMessage: state.toolWorkAfterLastMessage,
  }));
}
```

Production hosts should retain one trace per inbound turn, run recovery at most once, and make external side-effect tools idempotent.

## Pi extension factory

Hosts that load Pi extensions programmatically can register the same behavior directly:

```ts
import { createHumanMessageExtension } from "pi-human-message";

const extension = createHumanMessageExtension({
  send: async ({ toolCallId, text }) => deliverBoundConversation(text, toolCallId),
  maxMessagesPerTurn: 4,
  preferredMaxMessageChars: 700,
  maxMessageChars: 4_000,
  acknowledgement: "adaptive",
  format: "plain_text",
});
```

This is not a zero-config `pi install` package. A terminal Pi extension cannot infer your product's current Telegram/WeChat/Feishu destination or delivery idempotency. The application must inject the `send` port.

## Core API

- `createHumanMessageSystemPrompt(options)` builds the behavior contract.
- `withHumanMessageTurnReminder(text)` appends a compact host-authored reminder for long conversations.
- `createSendMessageAgentTool(send, options)` exposes one route-bound Pi tool with only a `text` argument.
- `createTurnBoundSendMessagePort(send, options)` enforces a hard 1–8 message cap for a host-defined turn.
- `inspectHumanMessageDelivery(trace)` detects silence or tool work after the last visible message.
- `createHumanMessageRecoveryPrompt(state)` closes that loop once without repeating delivered messages.
- `createHumanMessageExtension(options)` packages prompt, tool, and turn guard as a Pi extension factory.

The defaults are four messages per turn, a soft 700-character UX target, a hard 4,000-character portable ceiling, plain text, and adaptive acknowledgement for noticeable tool work.

## Behavioral principles

- One tool call is one complete, immediately visible bubble.
- Multiple bubbles are an option, never a quota.
- Boundaries come from intent and conversational beats, not punctuation.
- Brief/simple/one-message user instructions take priority.
- Truth and task closure take priority over requested message count.
- Tool output is the source of truth; missing evidence stays missing.
- Naturalness comes from judgment and pacing, not fake emotion or artificial delay.

## Channel integration contract

Every adapter implements the same narrow port:

```ts
type SendMessagePort = (
  request: { toolCallId: string; text: string },
  signal?: AbortSignal,
) => Promise<{
  messageId: string;
  externalMessageIds: string[];
  idempotentReplay: boolean;
}>;
```

Keep platform chunking, retries, rate limits, formatting escapes, reply/thread ids, and media handling in the channel adapter. Keep conversation judgment in this package. This lets Telegram, WeChat, Feishu, and future channels remain clean and independent.

## Development

```bash
git clone https://github.com/1zhangyy1/pi-human-message.git
cd pi-human-message
corepack enable
pnpm install
pnpm check
```

Run the local example or paid real-model evaluation only after supplying your own key:

```bash
cp .env.example .env
export OPENROUTER_API_KEY="..."
pnpm example -- "详细但像聊天一样解释一下"
EVAL_REPEATS=2 pnpm eval
```

Real-model evals are intentionally not part of CI. They cost money and remain stochastic. CI runs type checking, deterministic tests, build, and package inspection without secrets.

## Security and limits

The prompt is a behavior aid, not a security boundary. The host must enforce authorization, tenant isolation, destination binding, idempotency, rate limits, platform size limits, and confirmation for risky side effects. See [SECURITY.md](SECURITY.md).

The package currently sends text only. It does not implement media upload, reactions, typing indicators, delivery queues, scheduling, persistence, or a Telegram/WeChat/Feishu SDK.

## Inspiration and attribution

The design borrows useful invariants from Pi's extension/tool model and community GrokBot reconstructions: visible delivery must be explicit, internal prose is not a user message, and tool work must close the chat loop. It does **not** copy or claim access to xAI's private production prompt.

Evaluation-only comparison prompts adapt ideas from [`artickc/grok-telegram-bot`](https://github.com/artickc/grok-telegram-bot) and [`yuanyijie/learn-grok-bot`](https://github.com/yuanyijie/learn-grok-bot), both MIT licensed. See [NOTICE](NOTICE).

## Contributing

Bug reports and small, evidence-backed behavior improvements are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before changing the prompt: one compelling transcript is useful, but a scenario plus repeated regression evidence is better.

MIT licensed.
