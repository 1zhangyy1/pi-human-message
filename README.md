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

## In the Pi terminal

Chat view keeps the conversation focused on messages sent by the agent. Tool work stays in the session, and native confirmation dialogs remain visible. [See the real Pi 0.85.1 verification](docs/EVALUATION.md).

<details>
<summary>Earlier terminal example — v0.4.0</summary>

This historical transcript was reconstructed from a real run in Pi's original terminal view, not v0.5.0 chat view. The installation command below belongs to that old recording; use the current instructions under Install. Pi read the README, then sent the two messages requested by the user:

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

</details>

## Install

Chat view is verified on **Pi 0.85.1**. To install that version of [Pi](https://pi.dev/docs/latest):

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.85.1
```

Then install Human Message:

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.5.0
```

Run `pi`, then `/login` to connect a model provider if needed. If Pi is already open, run `/reload`. Use `/human-message` or `/human-message status` to check the current view. Existing sessions with ordinary assistant replies or errors stay in normal view; use `/new` to start a fresh chat view.

On a compatible Pi 0.85.1 runtime, chat view starts by default: `send_message` replies appear immediately, while ordinary Agent prose and tool activity stay out of the conversation. Press **F8**, or use `/human-message chat` and `/human-message normal`, to switch views. Normal view keeps the message tool and restores the activity trace.

Other Pi versions or uncertain display compatibility fall back to normal view. Errors and otherwise hidden answers do too; system and extension UI remain available. Human Message needs no Webhook, bot, or separate API key. [Compatibility details](docs/ARCHITECTURE.md#chat-display).

## Add it to your product

To use Human Message in Telegram, WeChat, Feishu, or another product, connect it to the product's existing message sender. See [Architecture](docs/ARCHITECTURE.md) for integration details.

## How it works

```text
Your task → Pi does the work with tools → agent calls send_message → one or more natural messages appear
```

It does not split finished prose by punctuation or character count, and it does not require a fixed number of messages. Chat view changes presentation, not tool execution or session history.

## Develop

```bash
pnpm install
pnpm check
```

[Examples](docs/SHOWCASE.md) · [Architecture](docs/ARCHITECTURE.md) · [Verification](docs/EVALUATION.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md)

<div align="center">

MIT licensed · Built for the Pi ecosystem

</div>
