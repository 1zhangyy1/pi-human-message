# Changelog

All notable changes are documented here. The project follows semantic versioning after the initial `0.1.0` release.

## 0.2.1 - 2026-09-03

- Redesign the project homepage as a concise, balanced English/Chinese README.
- Add a dependency-free, accessible HTML chat animation and generated README preview.
- Add a Pi package-gallery cover image.
- Clarify which examples are UI simulations and which are unedited real-model evidence.
- Audit the source with strict unused-symbol checks and keep channel-specific code out of the package.

## 0.2.0 - 2026-09-02

- Turn the repository into a discoverable Pi package with a default Extension entry.
- Add a safe route-bound Webhook delivery port and `/human-message` status command.
- Keep the installed extension inactive until a valid delivery endpoint is configured.
- Separate evaluation exports from the default runtime API.
- Add a runnable local Webhook demo and a real Pi CLI Extension smoke path.
- Add architecture documentation and unedited real-model message examples.
- Expand deterministic coverage from 14 to 20 tests.

## 0.1.0 - 2026-09-02

- Add the Agent-authored human-message system contract and compact turn reminder.
- Add a route-bound Pi `send_message` tool with delivery receipts.
- Add a resettable hard per-turn message cap.
- Add one-shot delivery recovery inspection and prompt.
- Add a programmatic Pi extension factory.
- Add 27 behavior scenarios, deterministic gates, and real-model evaluation runner.
- Add OpenRouter embedding example, security policy, contribution guide, and source attribution.
