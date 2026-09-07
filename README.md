<div align="center">

# Human Message

**Let Pi work. Get the result as natural chat messages.**

[English](README.md) · [简体中文](README.zh-CN.md)

<a href="https://github.com/1zhangyy1/pi-human-message/blob/main/assets/human-message-readme-en.mp4">
  <img src="https://raw.githubusercontent.com/1zhangyy1/pi-human-message/main/assets/human-message-readme-en.gif" width="900" alt="Human Message: Pi quietly checks messages and replies in natural chat messages">
</a>

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message?color=202323)](https://github.com/1zhangyy1/pi-human-message/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f5be)](LICENSE)

</div>

Human Message gives the agent one `send_message` tool. One call is one message; the agent decides where a real conversational pause belongs.

## A real Pi terminal run

This v0.4.0 transcript was reconstructed from a real run in Pi's original terminal view, not the new chat display. Pi read the README, then sent the two messages requested by the user:

```text
you › Read README.md. I want to share this plugin with a friend. First send
      the shortest install command as its own message. After it succeeds,
      send another message explaining where the effect appears. Keep both
      conversational, with no headings or numbers. Do not modify files.

Pi  │ read README.md
    │
Pi  │ pi install git:github.com/1zhangyy1/pi-human-message@v0.4.0
    │
Pi  └ Restart Pi, or run /reload in an open session. You will see the effect
      in the interactive Pi terminal, with every sent message shown separately.
```

The recorded run used Pi 0.84.4 and GPT-5.6 Luna. The two replies were two real `send_message` calls, with no duplicate final answer, and they remained separate after session resume. The terminal layout was reconstructed from the session record; this English transcript translates the original Chinese task and replies. In another real run, one cohesive answer stayed as one message—the plugin does not split merely for effect. [See the verification record](docs/EVALUATION.md).

## Install

If you do not have [Pi](https://pi.dev/docs/latest) yet:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

Then install Human Message:

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.4.0
```

Run `pi`. On first use, enter `/login` in Pi to choose a model provider. If Pi is already open, run `/reload` after installation. Use `/human-message` to confirm that delivery is active.

Use Pi 0.84.4 or newer. Human Message itself needs no Webhook, bot, or separate API key.

> **Unreleased — chat display:** in development for Pi 0.85.1; the install command above still installs v0.4.0.
> On a compatible runtime, chat display starts by default: `send_message` replies appear immediately, while ordinary Agent prose and tool activity stay out of the conversation.
> Use `/human-message chat` or `/human-message normal`, or press **F8** to switch. `/human-message` and `/human-message status` show the current state.
> Normal view keeps the message tool and restores the full activity trace. Errors, uncertain compatibility, or otherwise hidden answers restore normal view; system and extension UI remain available. [Compatibility details](docs/ARCHITECTURE.md#chat-display-unreleased).

## Add it to your product

To use Human Message in Telegram, WeChat, Feishu, or another product, connect it to the product's existing message sender. See [Architecture](docs/ARCHITECTURE.md) for integration details.

## How it works

```text
Your task → Pi does the work with tools → agent calls send_message → one or more natural messages appear
```

It does not split finished prose by punctuation or character count, and it does not require a fixed number of messages. The released v0.4.0 keeps Pi's normal tool work and errors visible.

## Develop

```bash
pnpm install
pnpm check
```

[Examples](docs/SHOWCASE.md) · [Architecture](docs/ARCHITECTURE.md) · [Verification](docs/EVALUATION.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md)

<div align="center">

MIT licensed · Built for the Pi ecosystem

</div>
