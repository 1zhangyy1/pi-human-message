# Architecture

Human Message has one behavior core and two assembly paths. It deliberately does not contain a generic channel framework.

## The product boundary

The extension owns:

- the instruction that `send_message` is the Agent's only visible voice;
- semantic message-boundary judgment;
- one route-bound text tool;
- a hard per-turn message cap;
- delivery receipts;
- delivery-state inspection and a one-shot recovery prompt;
- a safe generic Webhook port for the installable Pi package.

The host owns:

- inbound authentication and conversation identity;
- Telegram, WeChat, Feishu, Slack, or other SDKs;
- recipient, thread, and reply ids;
- rate limits, queues, retries, persistence, and idempotency;
- risky-action confirmation and tool authorization;
- channel formatting, media, and platform hard limits;
- durable turn identity and automatic recovery orchestration.

This split prevents the model from selecting a destination and prevents channel concerns from leaking into conversational judgment.

## Two entry points, one core

```text
                         package.json pi.extensions
                                    |
                                    v
                         extensions/index.ts
                                    |
                         createWebhookSendMessagePort
                                    |
                                    +-------------------+
                                                        |
Product host -> createHumanMessageExtension({ send }) --+--> prompt + tool + turn guard
```

### Installable Pi package

`extensions/index.ts` is a normal default-exported Pi Extension. Pi discovers it from `package.json#pi.extensions`.

It reads two environment variables:

- `PI_HUMAN_MESSAGE_WEBHOOK_URL`, required to activate delivery;
- `PI_HUMAN_MESSAGE_WEBHOOK_TOKEN`, optional bearer authentication.

Without a URL, the extension registers only `/human-message` status and stays inactive. It does not modify the system prompt or register `send_message`. This fail-closed state avoids breaking ordinary Pi conversations after an incomplete installation.

With a valid URL, it creates a route-bound Webhook port and invokes the same `createHumanMessageExtension()` factory used by embedded hosts.

### Embedded product extension

An IM product already knows the authenticated inbound conversation, so it should inject a JavaScript `SendMessagePort` directly. Pi's SDK accepts this factory through `DefaultResourceLoader.extensionFactories`. No HTTP hop or duplicated prompt is required.

## Turn lifecycle

```text
before_agent_start
  1. reset the delivery counter for the new prompt
  2. append the Human Message system contract
  3. add a hidden compact turn reminder after the current user prompt

model turn
  4. reason privately
  5. call send_message once per complete conversational beat
  6. receive a host delivery receipt
  7. use other tools when the user's task requires them
  8. send a confirmed result, question, or blocker after tool work

host turn boundary
  9. inspect visible-message/tool trace
  10. if needed, run no more than one recovery prompt with the same durable turn identity
```

Pi can produce several low-level model turns while resolving tool calls. The message cap belongs to the person-opened prompt, not to individual token streams. The installable extension resets and injects its hidden reminder on `before_agent_start`; an embedded Agent-core host uses `withHumanMessageTurnReminder()` when it submits the user's prompt. A host that runs recovery must keep its own durable turn boundary and avoid treating an infinite retry loop as recovery.

## Module responsibilities

| Module | Responsibility | Must not know about |
| --- | --- | --- |
| `prompt.ts` | behavior contract and compact turn reminder | channels, HTTP, credentials |
| `tool.ts` | Pi tool schema, receipts, hard delivery cap | Telegram/WeChat APIs |
| `pi-extension.ts` | Pi lifecycle wiring | environment variables, product routing |
| `webhook.ts` | HTTPS/local transport and receipt validation | model behavior, recipient selection |
| `recovery.ts` | trace inspection and recovery instruction | retry storage, channel SDKs |
| `evaluation.ts` | deterministic transcript gates | runtime package entry point |
| `extensions/index.ts` | install-time configuration and assembly | behavior duplication |

`evaluation.ts` is exported only as `pi-human-message/evaluation`; it is not re-exported from the default runtime API.

## Delivery protocol

One successful `send_message` tool call maps to one host delivery request. The payload contains only protocol version, tool-call id, and text.

The host returns a stable internal `messageId`, zero or more platform ids, and whether the request was an idempotent replay. HTTP error responses and malformed receipts fail the tool. The adapter never treats an unconfirmed response as success.

The Webhook URL is trusted configuration, not model input. Remote HTTP, embedded URL credentials, invalid JSON, and invalid receipts fail closed. The bearer token is read only from environment configuration and is never returned in status output.

“Visible” is relative to the bound chat destination. Pi's own terminal remains an operator surface; the extension cannot and does not promise to conceal every assistant event that Pi itself chooses to render there. Product hosts should render the confirmed delivery stream to end users and keep operator traces separate.

## Why there is no punctuation splitter

Post-generation splitting cannot know which clauses are emotional acknowledgement, explanation, correction, next step, limitation, or question. It also cannot safely undo a bubble that has already been delivered. Human Message makes boundaries part of the Agent's generation action: each tool call must already stand alone as one complete conversational act. A purpose change plus a natural pause creates the next call; punctuation or line breaks do not.

The 700-character default is a soft UX ceiling, not a target or slicing threshold. The host's `maxMessageChars` remains the actual hard transport guard.

## Why there are no built-in channel adapters

Telegram, WeChat, Feishu, and Slack differ in authentication, rate limits, thread identity, media, Markdown, retries, and account policy. Combining those concerns here would turn a small behavioral extension into another messaging platform.

Each product adapter should be thin and isolated:

```text
verified inbound route -> Pi session -> SendMessagePort -> one channel SDK
```

That keeps a Telegram reconnect bug from changing WeChat behavior and lets every channel use the same evaluated conversational contract.

## Recovery boundary

The core exposes `inspectHumanMessageDelivery()` and `createHumanMessageRecoveryPrompt()`, but the installable generic Webhook entry does not automatically start a recovery Agent run. Reliable recovery needs a durable product turn id, persisted delivery trace, and host scheduling semantics that a generic Pi package cannot infer safely.

This is intentional. A production host may run one recovery attempt. It must never retry indefinitely or repeat a message already confirmed by the delivery port.
