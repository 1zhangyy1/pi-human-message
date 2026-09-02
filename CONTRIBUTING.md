# Contributing

Thank you for helping make Agent conversations feel clearer and more natural.

## Local checks

Use Node.js 22.19+ and pnpm 10:

```bash
corepack enable
pnpm install
pnpm check
```

`pnpm check` performs type checking, deterministic tests, a production build, and an npm package dry run.

## Behavior changes

Prompt changes can fix one transcript while silently harming another. Please include:

- the user-visible failure being fixed;
- a deterministic or real-model scenario that captures it;
- repeated before/after results;
- actual message samples with private data removed;
- the model and provider used.

Prefer a small general invariant over model-specific wording. Do not add punctuation splitters, arbitrary post-generation chunking, artificial delays, or fake emotional behavior.

Real-model evaluation is optional, paid, and never runs in CI. Use only your own key and synthetic prompts. Do not commit `.env`, raw credentials, or private conversations.

## Pull requests

Keep each pull request focused. Update README/API docs when behavior or public types change, preserve attribution in `NOTICE`, and add a changelog entry for user-visible changes.

By contributing, you agree that your contribution is licensed under the repository's MIT license and to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
