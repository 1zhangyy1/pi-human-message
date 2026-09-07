<div align="center">

# Human Message · 拟人发消息

**让 Pi 做事，用聊天的方式告诉你结果。**

[English](README.md) · [简体中文](README.zh-CN.md)

<a href="https://github.com/1zhangyy1/pi-human-message/blob/main/assets/human-message-readme-zh.mp4">
  <img src="https://raw.githubusercontent.com/1zhangyy1/pi-human-message/main/assets/human-message-readme-zh.gif" width="900" alt="Human Message：Pi 在后台完成任务，再用自然的消息回复">
</a>

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message?color=202323)](https://github.com/1zhangyy1/pi-human-message/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f5be)](LICENSE)

</div>

Human Message 给 Agent 一个 `send_message` 工具。一次调用就是一条消息；该说一条还是几条，由 Agent 根据意思决定。

## 在真实 Pi 终端里

下面根据一次真实运行整理。Pi 先读取 README，再把安装方法自然地分成两条消息：

```text
你 › 请读一下 README.md。我要把这个插件发给朋友：请先单独发出
     最短安装命令；发送成功后，再单独发一条说明安装后在哪里看到
     效果。两条都像正常聊天，不加标题或编号。不要修改文件。

Pi │ 读取 README.md
   │
Pi │ pi install git:github.com/1zhangyy1/pi-human-message@v0.4.0
   │
Pi └ 安装后重启 Pi，或在已打开的 Pi 里运行 /reload；在交互式
     Pi 终端中就能看到效果，插件发出的每条消息会作为独立消息显示。
```

这次实跑使用 Pi 0.84.4 和 GPT-5.6 Luna。两条回复来自两次真实的 `send_message` 调用，没有重复的最终回答；恢复会话后也仍然是两条消息。上面的终端样式根据 session 记录重排，用户任务和 Pi 回复保持原文。另一次只需要一个完整回答的实跑仅发送了一条，插件不会为了凑效果强行拆分。[查看验证记录](docs/EVALUATION.md)

## 安装

还没有 [Pi](https://pi.dev/docs/latest)：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

然后安装 Human Message：

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.4.0
```

运行 `pi`。第一次使用可以在 Pi 中输入 `/login` 登录模型；如果 Pi 已经打开，安装后输入 `/reload`。再输入 `/human-message`，即可确认插件已经生效。

请使用 Pi 0.84.4 或更新版本。Human Message 本身不需要 Webhook、机器人或另一份 API Key。

## 接进自己的产品

要把 Human Message 接进 Telegram、微信、飞书或其他产品，只需连接产品已有的消息发送能力。具体接入方式见[实现说明](docs/ARCHITECTURE.md)。

## 怎么工作

```text
你提出任务 → Pi 使用工具完成工作 → Agent 调用 send_message → 显示一条或几条自然消息
```

它不会把生成好的长段落按标点或字数硬切开，也不要求固定发送几条。Pi 原本的工具过程和错误仍会正常显示。

## 开发

```bash
pnpm install
pnpm check
```

[更多例子](docs/SHOWCASE.zh-CN.md) · [实现说明](docs/ARCHITECTURE.md) · [验证记录](docs/EVALUATION.md) · [更新记录](CHANGELOG.md) · [安全说明](SECURITY.md)

<div align="center">

MIT 许可 · 为 Pi 生态而做

</div>
