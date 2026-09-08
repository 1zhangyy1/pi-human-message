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

聊天视图把注意力留给 Agent 发出的消息。工具过程仍保存在会话中，需要确认时，Pi 原生弹窗照常出现。[查看 Pi 0.85.1 的真实验证](docs/EVALUATION.md)。

## 安装

聊天视图已验证的版本是 **Pi 0.85.1**。安装这个版本的 [Pi](https://pi.dev/docs/latest)：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.85.1
```

然后安装 Human Message：

```bash
pi install git:github.com/1zhangyy1/pi-human-message
```

默认跟随 `main`，可能包含尚未正式发布的改动。之前锁定了旧版本，也可以重新运行这条命令解除锁定。需要固定版本、方便复现时，使用对应 [Release 页面](https://github.com/1zhangyy1/pi-human-message/releases)里的安装命令。

运行 `pi`，首次使用时输入 `/login` 连接模型服务。如果 Pi 已经打开，先输入 `/reload`，再用 `/human-message` 或 `/human-message status` 查看当前视图。已有普通回复或错误的旧会话会保留普通视图；输入 `/new` 即可新开聊天视图。

以后只更新这个插件，不升级 Pi 本身：

```bash
pi update --extension git:github.com/1zhangyy1/pi-human-message
```

更新后，在 Pi 中输入 `/reload`。

兼容的 Pi 0.85.1 环境默认开启聊天视图：`send_message` 回复即时显示，Agent 普通正文和工具过程不再混进对话。按 **F8**，或输入 `/human-message chat`、`/human-message normal` 切换；普通视图保留消息工具，并恢复完整过程。

其他 Pi 版本或显示兼容性不确定时，会回退普通视图；遇到错误或未发出的回答也一样。系统和扩展界面仍然保留。Human Message 本身不需要 Webhook、机器人或另一份 API Key。[兼容范围](docs/ARCHITECTURE.md#chat-display)。

## 接进自己的产品

要把 Human Message 接进 Telegram、微信、飞书或其他产品，只需连接产品已有的消息发送能力。具体接入方式见[实现说明](docs/ARCHITECTURE.md)。

## 怎么工作

```text
你提出任务 → Pi 使用工具完成工作 → Agent 调用 send_message → 显示一条或几条自然消息
```

它不会把生成好的长段落按标点或字数硬切开，也不要求固定发送几条。聊天视图只改变显示，不改工具执行或会话记录。

## 开发

```bash
pnpm install
pnpm check
```

[更多例子](docs/SHOWCASE.zh-CN.md) · [实现说明](docs/ARCHITECTURE.md) · [验证记录](docs/EVALUATION.md) · [更新记录](CHANGELOG.md) · [安全说明](SECURITY.md)

<div align="center">

MIT 许可 · 为 Pi 生态而做

</div>
