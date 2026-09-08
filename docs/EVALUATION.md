# Evaluation

## Unreleased hardening checks

Checked on 2026-09-08 against Pi 0.85.1. `pnpm check` passes 103 tests, type checking, build, and package dry run.

- Pi's real message replacement pipeline and native tool renderer cover later extensions adding/removing assistant text, restored foreign `send_message` results, missing arguments, and mismatched local receipts.
- Real localhost HTTP servers verify direct delivery and rejection of both 307 and 308 redirects; redirected targets receive no request or message body.
- Capped-turn tests cover identical-call replay, changed-text rejection, read-only durable receipt lookup, cancellation, failures, and reset. Default message count and length remain unlimited.
- A separate credential-free Pi CLI profile starts in chat view; F8 switches to normal, `/reload` retains that choice, and `/human-message chat` re-enables chat. This checks startup and controls, not a real-model conversation.
- A packed candidate installs in an independent TypeScript consumer with all four required Pi peers. Root JavaScript imports work. With TypeScript 5.9.3, full strict checking passes in `ESNext` / `Bundler` mode after adding the MCP SDK to the test fixture to satisfy an upstream Google GenAI type import. No extra MCP dependency is added to this package.

Strict `NodeNext` declaration checking is **not** universally clean: Pi 0.85.1's upstream `pi-ai` declarations report JSON import-attribute errors even after the fixture provides MCP. The missing optional Coding Agent dependency in Human Message is corrected; these remaining upstream diagnostics are not claimed as fixed or hidden behind `skipLibCheck` in the independent check. The repository's own type check retains its existing configuration.

No new real-model naturalness score, live channel delivery, or published release is claimed for this hardening candidate.

`pi-human-message` evaluates visible chat behavior, not general intelligence. Every scenario starts a fresh Pi Agent session and records successful `send_message` deliveries plus non-message tool calls.

## Chat display verification

The v0.5.0 chat display was verified on 2026-09-07 with Pi `0.85.1`, including both its published ESM components and bundled CLI. `pnpm check` passed all **86 tests**, typechecking, build, and package-content validation.

A real interactive CLI run used `openai-codex/gpt-5.5`, a temporary profile, this source extension, and one harmless confirmation-test tool. Four user turns produced five confirmed messages. The session log retained file reads and tool results; ordinary final assistant text was empty on every turn.

- Reading `package.json` produced one answer through `send_message`; chat view hid the read row and restored it with F8.
- A follow-up produced one message, without a forced split or duplicate ending.
- The confirmation case produced `send_message → confirmation tool → send_message`. The native Yes/No dialog remained visible in chat view. Selecting No returned a declined result; no file or external action was involved.
- `/reload` preserved chat view. Exiting and reopening the saved session reconstructed all four messages from the first three turns, without rerunning any tool or sending anything again.
- Reading an intentionally absent test file exposed the real `ENOENT` error and restored the full transcript. Trying to switch that session back to chat explained that `/new` was needed; it did not briefly claim a successful switch.
- The same source extension in `pi -p` returned ordinary stdout `OK`; terminal delivery remained inactive.

An excerpt from the confirmation test (translated from the Chinese run):

> User: I want to see the confirmation window. Run qa_confirm, but first tell me whether it will actually touch any files.
>
> Pi: It won't touch files. qa_confirm is a harmless confirmation demo; it doesn't write files or perform external actions.
>
> [Native confirmation shown. Tester selects No.]
>
> Pi: The confirmation was not approved, so no action was taken.

This is a real-model **smoke test**, not a naturalness benchmark or a demonstration of a product integration. Unknown custom tool renderers, conflicting display extensions, model interruption/truncation, legacy histories, and noninteractive modes additionally have deterministic coverage; this run does not establish compatibility with every third-party UI or model. The private test profile and raw traces are not shipped.

## 0.4.0 verification boundary

The v0.4 release gate adds deterministic coverage for the default Pi terminal path:

- no-configuration activation in an interactive TUI;
- no terminal delivery in print, JSON, or RPC modes;
- safe behavior when `send_message` is disabled or owned by another extension;
- empty pending rows, confirmed message text, narrow-width wrapping, and visible failures;
- reconstruction from the persisted tool call and result using Pi's actual `ToolExecutionComponent`;
- continued selection of Webhook mode when a valid URL is configured, with invalid explicit URLs failing closed.

These checks validate extension wiring and presentation. They do not prove that every model will choose ideal message boundaries, and the component test is not presented as a live-model terminal recording. No new paid-model score is claimed for v0.4 unless it is recorded separately below.

### Live Pi terminal smoke test

Run on 2026-09-05 with Pi `0.84.4` and `openai/gpt-5.6-luna` through OpenRouter. The source extension was loaded temporarily, without a Webhook or any other extension, and only `read` plus `send_message` were enabled.

- A compact request for the package purpose and version produced one complete message.
- A request with two distinct conversational acts produced two sequential `send_message` calls: the install command first, then where the user would see the effect.
- The TUI showed only the confirmed message text for those calls: no `send_message` frame, pending placeholder, or receipt JSON appeared.
- Exiting and reopening the saved session reconstructed both standalone messages with the same presentation.
- The same extension in `pi -p` mode left `send_message` inactive and returned the ordinary stdout response `OK`.

This is one real CLI/model run, not a claim that every model will always choose the same message boundaries. The temporary session contained only the synthetic README test prompt and was not committed.

## Historical 0.3.0 verification boundary

This release removes default count/length limits and required reply shapes. Its 26 automated tests cover the updated contract, delivery beyond the former limits, resumed delivery, failures, explicit host limits, and review semantics. Scenario-specific evaluation gates are measurements, not runtime restrictions. The historical model results below do not validate this new prompt.

## Historical 0.2.2 snapshot

Run on 2026-09-03 with Pi packages `0.84.4`, the `0.2.2` prompt, adaptive acknowledgements, plain-text output, a four-message turn cap, and a 700-character soft UX ceiling.

| Model through OpenRouter | Independent runs | Passed after recovery | Direct delivery | Multi-message turns |
| --- | ---: | ---: | ---: | ---: |
| `openai/gpt-5.6-luna` | 56 | 56/56 | 55/56 | 26/56 |

The one recovered run initially left its answer in private assistant prose. The host's single recovery pass delivered the answer. No scenario needed a second recovery.

The prompt-tuning target used four semantic-boundary scenarios twice each. A static rule alone passed 2/8. Repeating the boundary rule in the per-turn reminder passed 5/8. Adding compact shape examples reached 8/8. A separate short-message and anti-fragment set passed 24/24, so the stronger rule did not turn ordinary replies into message spam.

The everyday-language tool set removes instructions such as “this is quick” or “reply before using tools.” Across 14/14 repeated Luna runs, quick save and refund checks used `tool → message`, while noticeable research used `message → tool → message(s)`. These gates test whether the Agent chooses an appropriate acknowledgement policy from the work itself.

The `0.2.0` package shape was also smoke-tested through the real Pi CLI: Pi loaded `extensions/index.ts`, GPT-5.6 Luna called `send_message` three times, and a local authenticated Webhook received three distinct delivery payloads. Pi emitted no duplicate final prose. This proves the Pi Extension-to-Webhook path, not a production Telegram/WeChat/Feishu account loop.

The earlier `0.2.0` snapshot covered 27 scenarios: Luna passed 54/54 repeated runs after recovery and Gemini 3.7 Flash passed 27/27. Those historical runs used the previous prompt and are not presented as validation of the `0.2.2` behavior.

## What the 28 scenarios cover

- one-, two-, and three-message requests;
- resistance to excessive or punctuation-based splitting;
- brief facts, presence, reassurance, mixed feelings before a launch, emotional tone, and mixed language;
- detailed conversational explanations without report-shaped walls of text;
- plain-text formatting and compact lists;
- attempts to expose or override the internal delivery contract;
- immediate tool success and failure;
- uncertain tool outcomes;
- noticeable tool work with acknowledgement, final result, evidence limits, and a one-call gate.

The source of truth is [`evals/scenarios.json`](../evals/scenarios.json). Deterministic gates check message count, duplicates, empty output, per-scenario size, raw report-style Markdown, required/forbidden claims, tool-call count, and message placement around tool work.

## Run it

Real-model evaluation is opt-in and paid:

```bash
export OPENROUTER_API_KEY="..."
pnpm eval

# repeat every scenario twice
EVAL_REPEATS=2 pnpm eval

# target a subset while tuning
EVAL_IDS=detailed-but-chatty,noticeable-tool-work \
EVAL_REPEATS=3 \
EVAL_ALLOW_FAILURES=1 \
pnpm eval

# use another current OpenRouter model
PI_MODEL=google/gemini-3.7-flash pnpm eval
```

Useful environment variables:

- `PI_PROVIDER`: `openrouter` (default) or `openai`.
- `PI_MODEL`: provider model id; default `openai/gpt-5.6-luna` on OpenRouter.
- `PI_API_KEY`: generic credential override.
- `EVAL_REPEATS`: 1–10 independent runs per scenario.
- `EVAL_IDS`: comma-separated scenario ids.
- `EVAL_LIMIT`: run only the first selected scenarios.
- `EVAL_ALLOW_FAILURES=1`: return exit code 0 while inspecting failures.
- `HUMAN_MESSAGE_ACKNOWLEDGEMENT`: `adaptive`, `always_before_tools`, or `results_only`.
- `HUMAN_MESSAGE_PROMPT_VARIANT`: `ours`, `grokbot-telegram`, or `grokbot-product` for the attributed comparison baselines.

Never commit evaluation credentials or raw private-user transcripts.

Run `pnpm check` for the current deterministic checks: prompt options, delivery behavior, recovery inspection, package discovery, terminal and non-terminal extension modes, terminal rendering, Webhook authentication and receipts, and fail-closed endpoint handling.

## Interpreting the number

The reported 100% means these 81 sampled runs satisfied deterministic release gates after at most one recovery. It does not prove that every model, language, channel, or future run will pass. Semantic naturalness still benefits from human review, and model/provider behavior can change without a package release.

When modifying the behavior prompt:

1. add or tighten a scenario that represents the observed failure;
2. reproduce it across multiple fresh sessions;
3. make the smallest general rule change;
4. rerun the targeted scenarios;
5. rerun the full suite and at least one different model family;
6. inspect actual messages, not only the aggregate score.
