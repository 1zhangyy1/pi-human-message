# Architecture

Human Message has one behavior core and three ways to present a delivered message: the interactive Pi terminal, an optional Webhook, or a send function supplied by an embedded host. It deliberately does not contain a generic channel framework.

## The product boundary

The extension owns:

- truthful instructions for the selected delivery surface;
- semantic message-boundary judgment;
- one text-only `send_message` tool whose destination is fixed by the selected surface;
- optional host-configured limits, with no default count or character ceiling;
- delivery receipts;
- delivery-state inspection and a one-shot recovery prompt;
- a small native presentation for confirmed messages in Pi's interactive terminal;
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

## One core, three delivery paths

```text
                         package.json pi.extensions
                                    |
                                    v
                         extensions/index.ts
                           /                 \
                   no Webhook             valid Webhook
                       |                        |
               terminal port + renderer     Webhook port
                           \                 /
                            createHumanMessageExtension
                                      |
                              prompt + tool + receipts

Embedded host -> createHumanMessageExtension({ send })
```

### Installable Pi package

`extensions/index.ts` is a normal default-exported Pi Extension. Pi discovers it from `package.json#pi.extensions`.

It reads two environment variables:

- `PI_HUMAN_MESSAGE_WEBHOOK_URL`, optional; when present, it selects Webhook delivery;
- `PI_HUMAN_MESSAGE_WEBHOOK_TOKEN`, optional bearer authentication.

Without a URL, the package registers `send_message` for Pi's interactive TUI. A successful tool result is rendered as one standalone terminal message. The pending tool call and receipt JSON render as empty rows; a failed result remains visible as an error. `/human-message` reports whether the mode is active.

Terminal mode does not inject another assistant or custom message into the session. Pi already persists the tool call, its arguments, and its result, so the same renderer can reconstruct the message when a session is resumed. Ordinary Pi assistant text remains visible, and the terminal-specific prompt tells the Agent not to repeat a reply it already sent.

The local port is enabled only after an interactive TUI session starts and only while this extension owns the registered `send_message` tool. Print, JSON, and RPC sessions remove it from the active tool set. If the user disabled the tool or another extension owns the same name, Human Message stays inactive rather than claiming a delivery it cannot present.

With a valid URL, it creates a route-bound Webhook port and invokes the same `createHumanMessageExtension()` factory used by embedded hosts.

An explicitly configured but invalid URL never falls back to terminal delivery. That would silently send content to the wrong surface, so invalid remote configuration remains fail-closed.

### Embedded product extension

An IM product already knows the authenticated inbound conversation, so it should inject a JavaScript `SendMessagePort` directly. Pi's SDK accepts this factory through `DefaultResourceLoader.extensionFactories`. No HTTP hop or duplicated prompt is required. `bound_chat` remains the default delivery surface for this programmatic API, so existing embedded integrations keep their behavior.

## Turn lifecycle

```text
before_agent_start
  1. reset the delivery counter for the new prompt
  2. append the Human Message system contract
  3. add a hidden compact turn reminder after the current user prompt

model turn
  4. reason privately
  5. call send_message once per complete conversational beat when a separate message helps
  6. receive a host delivery receipt
  7. use other tools when the user's task requires them
  8. send a confirmed result, question, or blocker after tool work

host turn boundary
  9. inspect visible-message/tool trace
  10. if needed, run no more than one recovery prompt with the same durable turn identity
```

Pi can produce several low-level model turns while resolving tool calls. There is no default message-count limit. The installable extension resets its delivery counter and injects the reminder for the active surface on `before_agent_start`; an embedded Agent-core host uses `withHumanMessageTurnReminder()` when it submits the user's prompt. Hosts that explicitly configure a cap can use `initialSentCount` to account for already committed messages on resume. A recovery review belongs to the same durable user turn, not a new task or an indefinite retry loop.

## Module responsibilities

| Module | Responsibility | Must not know about |
| --- | --- | --- |
| `prompt.ts` | behavior contract and compact turn reminder | channels, HTTP, credentials |
| `tool.ts` | Pi tool schema, receipts, optional host limits | Telegram/WeChat APIs |
| `pi-extension.ts` | Pi lifecycle wiring | environment variables, product routing |
| `extensions/terminal.ts` | confirmed-message rendering in Pi's TUI | external channels, prompt policy |
| `webhook.ts` | HTTPS/local transport and receipt validation | model behavior, recipient selection |
| `recovery.ts` | trace inspection and recovery instruction | retry storage, channel SDKs |
| `evaluation.ts` | deterministic transcript gates | runtime package entry point |
| `extensions/index.ts` | install-time configuration and assembly | behavior duplication |

`evaluation.ts` is exported only as `pi-human-message/evaluation`; it is not re-exported from the default runtime API.

## Delivery protocol

In Webhook and embedded-host modes, one successful `send_message` tool call maps to one host delivery request. The Webhook payload contains only protocol version, tool-call id, and text.

The host returns a stable internal `messageId`, zero or more platform ids, and whether the request was an idempotent replay. HTTP error responses and malformed receipts fail the tool. The adapter never treats an unconfirmed response as success.

In terminal mode, delivery is local and makes no network request. Its stable receipt is derived from the tool-call id. The renderer reveals the original text only after that receipt succeeds; it does not turn a pending or failed call into an apparent message.

The Webhook URL is trusted configuration, not model input. Remote HTTP, embedded URL credentials, invalid JSON, and invalid receipts fail closed. The bearer token is read only from environment configuration and is never returned in status output.

“Visible” depends on the selected surface. In a bound external chat, `send_message` is the Agent's delivered voice and plain assistant text remains host-side. In terminal mode, both ordinary assistant text and confirmed `send_message` rows are visible, so the prompt forbids duplicate replies. The extension does not promise to conceal Pi's own tool, assistant, or error output. Product hosts should still render only the confirmed delivery stream to end users and keep operator traces separate.

## Why there is no punctuation splitter

Post-generation splitting cannot know where a useful conversational pause belongs, and it cannot safely undo an already delivered bubble. Human Message makes boundaries part of the Agent's generation action. A separate thought or later result can deserve another call; closely related sentences can stay together. There is no required template or one-bubble-per-purpose rule.

There is no default character target or ceiling. Hosts can explicitly configure `maxMessageChars` when their delivery port requires one, or handle platform limits in their existing renderer. Empty messages are still rejected.

## Why there are no built-in channel adapters

Telegram, WeChat, Feishu, and Slack differ in authentication, rate limits, thread identity, media, Markdown, retries, and account policy. Combining those concerns here would turn a small behavioral extension into another messaging platform.

Each product adapter should be thin and isolated:

```text
verified inbound route -> Pi session -> SendMessagePort -> one channel SDK
```

That keeps a Telegram reconnect bug from changing WeChat behavior and lets every channel use the same evaluated conversational contract.

## Recovery boundary

The core exposes `inspectHumanMessageDelivery()` and `createHumanMessageRecoveryPrompt()`, but the installable package does not automatically start a recovery Agent run. Reliable recovery needs a durable product turn id, persisted delivery trace, and host scheduling semantics that a generic Pi package cannot infer safely.

This is intentional. A production host may run one review using the existing transcript and only the `send_message` tool. It must not re-execute external actions or repeat confirmed messages. Check genuine provider errors before starting a review; do not disguise an outage as a missing message.

`needsRecovery` is a compatibility name for a heuristic: a tool ran after the last message, or nothing was delivered. It does not prove that delivery failed. If the Agent reviews the result and finds nothing new to say, already delivered messages remain valid. Do not append a generic failure just because this flag remains true. A completely silent turn can get an accurate no-answer notice, without instructing the user to repeat potentially completed writes.
