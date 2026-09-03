# Evaluation

`pi-human-message` evaluates visible chat behavior, not general intelligence. Every scenario starts a fresh Pi Agent session and records successful `send_message` deliveries plus non-message tool calls.

## Release snapshot

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

Deterministic release checks contain 20 tests covering prompt options, semantic delivery guards, recovery inspection, package discovery, inactive/active extension states, Webhook authentication and receipts, and fail-closed endpoint handling.

## Interpreting the number

The reported 100% means these 81 sampled runs satisfied deterministic release gates after at most one recovery. It does not prove that every model, language, channel, or future run will pass. Semantic naturalness still benefits from human review, and model/provider behavior can change without a package release.

When modifying the behavior prompt:

1. add or tighten a scenario that represents the observed failure;
2. reproduce it across multiple fresh sessions;
3. make the smallest general rule change;
4. rerun the targeted scenarios;
5. rerun the full suite and at least one different model family;
6. inspect actual messages, not only the aggregate score.
