# Evaluation

`pi-human-message` evaluates visible chat behavior, not general intelligence. Every scenario starts a fresh Pi Agent session and records successful `send_message` deliveries plus non-message tool calls.

## Release snapshot

Run on 2026-09-02 with Pi packages `0.84.4`, the default prompt, adaptive acknowledgements, plain-text output, a four-message turn cap, and a 700-character soft UX target.

| Model through OpenRouter | Independent runs | Passed after recovery | Direct delivery | Longest bubble |
| --- | ---: | ---: | ---: | ---: |
| `openai/gpt-5.6-luna` | 54 | 54/54 | 52/54 | 355 chars |
| `google/gemini-3.7-flash` | 27 | 27/27 | 27/27 | 226 chars |
| Combined | 81 | 81/81 | 79/81 | 355 chars |

The two recovered Luna runs were ordinary text turns where the model initially left its answer in private assistant prose. The host's single recovery pass delivered the answer. No scenario needed a second recovery.

The `0.2.0` package shape was also smoke-tested through the real Pi CLI: Pi loaded `extensions/index.ts`, GPT-5.6 Luna called `send_message` three times, and a local authenticated Webhook received three distinct delivery payloads. Pi emitted no duplicate final prose. This proves the Pi Extension-to-Webhook path, not a production Telegram/WeChat/Feishu account loop.

Before the final prompt and reminder changes, the same Luna suite passed 49/54 runs, directly delivered 48/54, and produced a longest bubble above 1,100 characters. The failures concentrated in detailed answers and noticeable tool-work summaries; that evidence drove the soft bubble budget, stronger evidence grounding, and end-of-turn reminder.

## What the 27 scenarios cover

- one-, two-, and three-message requests;
- resistance to excessive or punctuation-based splitting;
- brief facts, presence, reassurance, emotional tone, and mixed language;
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
