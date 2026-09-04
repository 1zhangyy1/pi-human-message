<div align="center">

# Human Message

**Let Pi do the work, then reply like it belongs in chat.**

[English](README.md) · [简体中文](README.zh-CN.md)

<a href="https://github.com/1zhangyy1/pi-human-message/blob/main/assets/human-message-readme-en.mp4">
  <img src="https://raw.githubusercontent.com/1zhangyy1/pi-human-message/main/assets/human-message-readme-en.gif" width="900" alt="Human Message: Pi quietly checks messages and replies in natural chat bubbles">
</a>

<sub>See the whole idea in 8 seconds · click for MP4</sub>

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message?color=202323)](https://github.com/1zhangyy1/pi-human-message/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f5be)](LICENSE)

</div>

## What it is

Human Message is a tiny Pi plugin.

Pi already knows how to call tools and finish work. This plugin handles the last step: it lets Pi decide whether a reply needs one message or a few natural chat bubbles.

- Short answers stay short.
- Background work stays out of the conversation.
- Pi chooses when a separate thought or later result deserves another bubble.
- No fixed message count or character target.
- Nothing is split mechanically by punctuation or length.

## What it feels like

A quick task finishes before the reply:

> **You:** Did I ever reply to Alex about Friday?
>
> *Pi checks your messages and calendar in the background.*
>
> **Pi:** No — the thread stopped after Alex asked if 3pm works.
>
> **Pi:** You’re free then. Want me to reply?

After you confirm, the answer stays simple:

> **You:** Yes, tell him that works.
>
> *Pi sends the reply.*
>
> **Pi:** Done.

See the [full showcase](docs/SHOWCASE.md) for more examples.

## Install

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.3.0
```

Human Message is not a Telegram, Feishu, or Slack bot. Connect it to the message delivery method your app already uses. See the [integration guide](docs/ARCHITECTURE.md).

## It does three things

1. Gives Pi a `send_message` capability.
2. Turns each call into one complete chat bubble.
3. Offers a delivery-review prompt if Pi forgets to send the result.

Your app still owns channels, recipients, retries, and permissions.

## Verified

Automated checks cover delivery, Pi extension loading, optional limits, and recovery. Earlier Luna runs and real Pi CLI checks are versioned in the [evaluation notes](docs/EVALUATION.md); they are not proof of this release's new prompt behavior.

## Develop

```bash
pnpm install
pnpm check
```

[Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

<div align="center">

MIT licensed · Built for the Pi ecosystem

</div>
