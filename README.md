<div align="center">

# Human Message

**Let Pi do the work, then reply like it belongs in chat.**

[English](README.md) · [简体中文](README.zh-CN.md)

<a href="https://github.com/1zhangyy1/pi-human-message/blob/main/assets/human-message-readme-en.mp4">
  <img src="https://raw.githubusercontent.com/1zhangyy1/pi-human-message/main/assets/human-message-readme-en.gif" width="900" alt="Human Message: Pi quietly checks messages and replies in natural chat messages">
</a>

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message?color=202323)](https://github.com/1zhangyy1/pi-human-message/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f5be)](LICENSE)

</div>

## Install and use

Use Pi 0.84.4 or newer. The terminal integration is tested with Pi 0.84.4 and 0.85.0.

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.4.0
```

Start Pi, or run `/reload` if Pi is already open. That is all: no Webhook, bot, or extra API key is required.

In the interactive Pi terminal, the Agent gets a `send_message` tool. Every successful call appears as one quiet, standalone message. Pi still shows its normal tool work and errors.

> **You:** Check why the login callback is failing and fix it.
>
> *Pi inspects the project and makes the change.*
>
> **Pi:** Found it — the callback URL did not match the configured origin.
>
> **Pi:** I fixed it and the login test now passes.

Human Message does not split prose after generation. The Agent decides whether the answer needs one message or a few, based on meaning and natural pauses. Short answers stay short; there is no required message count or character target.

Run `/human-message` to see whether terminal delivery is active. The default terminal experience is enabled only in Pi's interactive TUI; print, JSON, and RPC modes keep their normal output behavior.

## Send to another app

Webhook delivery is an optional advanced mode for products that already know the destination:

```bash
export PI_HUMAN_MESSAGE_WEBHOOK_URL="https://your-app.example/send"
export PI_HUMAN_MESSAGE_WEBHOOK_TOKEN="your-secret" # optional
pi
```

Setting a valid Webhook URL switches the installed extension from terminal delivery to the existing route-bound Webhook. Your application still owns the recipient, authentication, retries, permissions, and channel SDK.

For an embedded Pi host, inject its existing send function directly instead of adding an HTTP hop. See [Architecture](docs/ARCHITECTURE.md).

## Upgrading from v0.3

An install pinned to `@v0.3.0` does not change. It remains on v0.3 until you explicitly install another ref.

In v0.3, an installation without a Webhook stayed inactive. In v0.4, that same setup becomes useful in the interactive Pi terminal. Existing valid Webhook configurations continue to use Webhook delivery.

## What the plugin changes

- It gives the Agent one `send_message` tool.
- It lets the Agent choose natural message boundaries while it works.
- It changes only how successful `send_message` calls appear; it does not create another conversation history or replace Pi's terminal.

Automated checks cover prompt behavior, delivery receipts, terminal rendering, resumed display, Webhook validation, optional limits, and recovery. Historical live-model results are kept separately in [Evaluation](docs/EVALUATION.md).

## Develop

```bash
pnpm install
pnpm check
```

[Examples](docs/SHOWCASE.md) · [Architecture](docs/ARCHITECTURE.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

<div align="center">

MIT licensed · Built for the Pi ecosystem

</div>
