<div align="center">

# Human Message · 拟人发消息

**让 Pi 做完事以后，像聊天一样回复你。**

[English](README.md) · [简体中文](README.zh-CN.md)

<a href="https://github.com/1zhangyy1/pi-human-message/blob/main/assets/human-message-readme-zh.mp4">
  <img src="https://raw.githubusercontent.com/1zhangyy1/pi-human-message/main/assets/human-message-readme-zh.gif" width="900" alt="Human Message：Pi 在后台安静完成任务，再用自然的聊天气泡回复">
</a>

<sub>8 秒看懂它 · 点击观看 MP4</sub>

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message?color=202323)](https://github.com/1zhangyy1/pi-human-message/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f5be)](LICENSE)

</div>

## 它是什么

Human Message 是一个很小的 Pi 插件。

Pi 本来就会调用工具、完成任务。这个插件只解决最后一步：让 Pi 自己判断该发几条、何时回复，以及在哪里自然停顿。

- 简单回答保持简短。
- 后台动作不会变成聊天噪音。
- 独立的想法或稍后完成的结果，可以另发一条。
- 不规定消息条数，也不规定字数目标。
- 不按标点或字数机械切段。

## 看起来怎样

快速任务做完再回复：

> **你：** 帮我记一下，下周一上午十点和小周开会。
>
> *Pi 在后台保存提醒。*
>
> **Pi：** 记好了：下周一上午十点和小周开会。

需要多说一步时，才自然分成两条：

> **你：** 我想发这个插件，但越看 README 越觉得不对，有点不敢发了。
>
> **Pi：** 这很正常。你不是做得不好，只是已经盯太久了。
>
> **Pi：** 先只检查安装、示例、限制和许可证，其他先别改。

更多例子见[完整消息集](docs/SHOWCASE.zh-CN.md)。

## 安装

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.3.0
```

Human Message 不包含 Telegram、飞书或 Slack 机器人。把它接到你已有的消息发送方法即可，具体方式见[接入说明](docs/ARCHITECTURE.md)。

## 它只做三件事

1. 给 Pi 一个 `send_message` 能力。
2. 每次调用发送一个完整聊天气泡。
3. 如果 Pi 忘记发送结果，提供一次交付检查的提示词。

渠道、收件人、重试和权限仍由你的应用负责。

## 已验证

自动化检查覆盖发送、Pi 插件加载、可选限制和交付检查。之前的 Luna 实跑与真实 Pi CLI 验证按版本记录在[评测说明](docs/EVALUATION.md)，不冒充本版新提示词的验证结果。

## 开发

```bash
pnpm install
pnpm check
```

[架构](docs/ARCHITECTURE.md) · [贡献指南](CONTRIBUTING.md) · [安全说明](SECURITY.md)

<div align="center">

MIT 许可 · 为 Pi 生态而做

</div>
