<div align="center">

# Human Message

**One conversational beat, one bubble.**

A Pi extension that lets the Agent shape a reply as one or a few natural chat messages.

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message?color=202323)](https://github.com/1zhangyy1/pi-human-message/releases)
[![Pi package](https://img.shields.io/badge/Pi-package-b9a9ff)](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f5be)](LICENSE)

<br>

<a href="https://github.com/1zhangyy1/pi-human-message/blob/main/demo/index.html">
  <img src="https://raw.githubusercontent.com/1zhangyy1/pi-human-message/main/assets/human-message-demo.gif" width="920" alt="Human Message animated chat demonstration">
</a>

<sub>A dependency-free HTML/CSS animation. The real model transcripts below are separate evidence.</sub>

</div>

## What it changes

Most chat agents either send one report-shaped wall of text or split finished prose mechanically. Human Message gives the Agent one route-bound `send_message` tool and teaches it to choose message boundaries while composing the answer.

- A short answer stays in one bubble.
- A change of conversational purpose can start another bubble.
- Related sentences with the same purpose stay together.
- Punctuation, line breaks, and character counts never create bubbles by themselves.
- The Agent does not imitate typing delays or pretend to be human.

## See the behavior

Each **Agent bubble** below represents a separate `send_message` call. These are shape-preserving translations of unedited GPT-5.6 Luna runs; the [showcase](docs/SHOWCASE.md) keeps the original transcripts.

### 1. A presence check stays one bubble

**You**

> Are you there?

**Agent · bubble 1**

> I’m here. What’s up?

### 2. Empathy and practical advice become two beats

**You**

> I want to release this plugin this weekend, but the more I read the README, the more everything feels wrong. I’m starting to feel afraid to ship it.

**Agent · bubble 1**

> That feeling is normal. The closer a README gets to release, the easier it is to notice only what still feels imperfect. It does not mean the plugin is not ready. Do not let “perfect” become the release bar.

**Agent · bubble 2**

> Treat this as a release check: look only at installation, what the plugin does, one example, known limits, and the license. Ignore the remaining polish for now.

### 3. A natural two-part question becomes two useful answers

**You**

> I want to make Telegram solid before adding Feishu. Does that order make sense? What should I validate first?

**Agent · bubble 1**

> That order makes sense. First make one Telegram flow reliable, then reuse the channel-independent core for Feishu. Just avoid burying product rules inside the Telegram bot.

**Agent · bubble 2**

> Validate one end-to-end loop first: a real message arrives, the right user and session are identified, the Agent uses the right capability, and the result returns without loss, duplication, or cross-chat leakage.

### 4. A quick tool runs quietly, then the result appears

**You**

> Remember this for me: meeting with Zhou next Monday at 10 a.m.

*Private work · not shown in chat: `save_note` succeeds*

**Agent · bubble 1**

> Saved: meeting with Zhou next Monday at 10 a.m.

### 5. An uncertain lookup stays honest

**You**

> Can you check whether last week’s refund has arrived?

*Private work · not shown in chat: `check_refund` returns uncertain*

**Agent · bubble 1**

> I still cannot confirm that it arrived. The payment processor has not confirmed this refund yet.

### 6. Noticeable work gets a brief acknowledgement and a real result

**You**

> Can you look into whether Telegram or Feishu is the better place for us to launch first and give me a clear recommendation?

**Agent · bubble 1**

> I’ll compare the current product capabilities, compliance constraints, and launch requirements, then give you a clear recommendation.

*Private work · not shown in chat: `research_channels` runs*

**Agent · bubble 2**

> If the first launch is for external early users and community feedback, start with Telegram. Add Feishu afterward for internal workflows and collaboration.

**Agent · bubble 3**

> If the first users are Chinese companies using it for internal work, reverse the order and start with Feishu. The available evidence here was directional, so pricing and compliance details still need a sourced comparison.

More natural conversations and the separate reliability tests are in the [full showcase](docs/SHOWCASE.md).

## What stays behind the chat

```text
Quick action       You → [tool runs privately] → result bubble
Noticeable work    You → short acknowledgement → [tool runs privately] → result bubble(s)
```

Only successful `send_message` calls belong in the end-user conversation. Pi's terminal may still show operator traces; the product host must render the confirmed delivery stream rather than raw assistant text or tool events.

## How it works

| 1 · Shape | 2 · Send | 3 · Deliver |
| --- | --- | --- |
| The Agent plans 1–4 complete conversational acts. | Each `send_message` call creates one bubble. | The host delivers it to the already-bound conversation. |

The boundary is intentionally small:

| Agent decides | Host enforces |
| --- | --- |
| Message count, grouping, and tone | Authenticated destination and tenant |
| Whether an acknowledgement is useful | Idempotency, retries, and rate limits |
| How to express confirmed tool results | Channel formatting and hard limits |

Telegram, WeChat, Feishu, and Slack adapters stay in the product host. This package owns message expression only, so channel implementations remain isolated.

Read the full [architecture](docs/ARCHITECTURE.md).

## Install

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.2.2
```

Bind the extension to a delivery endpoint owned by your application. The model never sees or chooses a channel, recipient, or chat id.

```bash
export PI_HUMAN_MESSAGE_WEBHOOK_URL="https://your-host.example/deliver/current-conversation"
export PI_HUMAN_MESSAGE_WEBHOOK_TOKEN="your-secret"
pi
```

Run `/human-message` inside Pi to check whether delivery is active. Without a valid endpoint, the extension stays safely inactive.

## Embed it in a product

Long-running IM services can inject a JavaScript delivery port directly instead of using the generic Webhook.

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

## Evidence

| Check | Result |
| --- | ---: |
| GPT-5.6 Luna current-prompt turns | 56 / 56 |
| Autonomous semantic-boundary turns | 8 / 8 |
| Short-message anti-fragment turns | 24 / 24 |
| Deterministic tests | 20 / 20 |
| Real Pi CLI → authenticated local Webhook | Passed |
| Clean remote-tag installation | Passed |

This snapshot is reproducible evidence, not a guarantee for every future model or channel. Production Telegram, WeChat, Feishu, and Slack account loops still belong to their host applications and require separate testing.

Read the [evaluation method and limits](docs/EVALUATION.md).

## Repository

```text
extensions/index.ts   installable Pi entry
src/prompt.ts         behavior contract and turn reminder
src/tool.ts           send_message and hard limits
src/pi-extension.ts   shared ExtensionFactory
src/webhook.ts        route-bound delivery
src/recovery.ts       one-shot recovery helpers
demo/index.html       dependency-free visual demo
evals/ + test/        model scenarios and deterministic gates
```

No channel framework, UI framework, database, or hidden service is bundled. Runtime behavior depends only on Pi peer packages; evaluation code is isolated behind the `pi-human-message/evaluation` export.

## Develop

```bash
pnpm install
pnpm check
```

Open [`demo/index.html`](demo/index.html) to replay the visual demo. Paid real-model evaluation is opt-in:

```bash
OPENROUTER_API_KEY="..." EVAL_REPEATS=2 pnpm eval
```

Please read [CONTRIBUTING](CONTRIBUTING.md), [SECURITY](SECURITY.md), and [NOTICE](NOTICE) before contributing or deploying.

<div align="center">

MIT licensed · Built for the Pi ecosystem

</div>
