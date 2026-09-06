<div align="center">

# Human Message · 拟人发消息

**让 Pi 做完事以后，像聊天一样回复你。**

[English](README.md) · [简体中文](README.zh-CN.md)

<a href="https://github.com/1zhangyy1/pi-human-message/blob/main/assets/human-message-readme-zh.mp4">
  <img src="https://raw.githubusercontent.com/1zhangyy1/pi-human-message/main/assets/human-message-readme-zh.gif" width="900" alt="Human Message：Pi 在后台完成任务，再用自然的消息回复">
</a>

[![CI](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml/badge.svg)](https://github.com/1zhangyy1/pi-human-message/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/1zhangyy1/pi-human-message?color=202323)](https://github.com/1zhangyy1/pi-human-message/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-c9f5be)](LICENSE)

</div>

## 安装后直接使用

请使用 Pi 0.84.4 或更新版本。终端接入已在 Pi 0.84.4 和 0.85.0 上验证。

```bash
pi install git:github.com/1zhangyy1/pi-human-message@v0.4.0
```

启动 Pi；如果 Pi 已经打开，执行一次 `/reload`。这样就可以了，不需要 Webhook、机器人或另一份 API Key。

在 Pi 的交互式终端里，Agent 会得到一个 `send_message` 工具。每次发送成功，就会干净地显示成一条独立消息；Pi 原本的工具过程和错误仍会正常显示。

> **你：** 看看登录回调为什么失败，顺便修好。
>
> *Pi 检查项目并完成修改。*
>
> **Pi：** 找到了，是回调地址和配置的域名不一致。
>
> **Pi：** 已经修好，登录测试也通过了。

插件不会在生成后按标点或字数切段。该说一条还是几条、在哪里自然停顿，都由 Agent 根据意思决定。简单回答仍然只说一句，也没有固定条数或字数目标。

输入 `/human-message` 可以查看终端发送是否生效。默认终端体验只在 Pi 的交互式 TUI 中启用；print、JSON 和 RPC 模式继续保持 Pi 原本的输出方式。

## 发到其他聊天应用

Webhook 是给产品接入用的高级模式，不是普通用户安装插件的前置条件：

```bash
export PI_HUMAN_MESSAGE_WEBHOOK_URL="https://your-app.example/send"
export PI_HUMAN_MESSAGE_WEBHOOK_TOKEN="your-secret" # 可选
pi
```

配置有效的 Webhook 地址后，插件会从终端发送切换为原有的定向 Webhook 投递。收件人、鉴权、重试、权限和各渠道 SDK，仍由你的应用负责。

如果产品本身已经嵌入 Pi，可以直接传入现有的发送函数，不需要多绕一层 HTTP。详见[实现说明](docs/ARCHITECTURE.md)。

## 从 v0.3 升级

固定安装在 `@v0.3.0` 的用户不会被自动改变；只有主动安装新版本，才会进入 v0.4。

v0.3 在没有 Webhook 时会保持停用。v0.4 则会默认在 Pi 交互式终端中生效。已经配置了有效 Webhook 的用户，升级后仍然走原来的 Webhook 投递。

## 插件做了什么

- 给 Agent 一个 `send_message` 工具。
- 让 Agent 在工作过程中自己决定自然的消息边界。
- 只改变发送成功后的终端展示，不复制一份聊天记录，也不替换 Pi 的终端。

自动化检查覆盖提示词、发送回执、终端展示、恢复会话后的展示、Webhook 校验、可选限制和交付检查。历史实跑结果单独记录在[评测说明](docs/EVALUATION.md)中。

## 开发

```bash
pnpm install
pnpm check
```

[更多例子](docs/SHOWCASE.zh-CN.md) · [实现说明](docs/ARCHITECTURE.md) · [安全说明](SECURITY.md) · [贡献指南](CONTRIBUTING.md)

<div align="center">

MIT 许可 · 为 Pi 生态而做

</div>
