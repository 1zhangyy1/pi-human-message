import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import test from "node:test";

import {
  createTerminalSendMessagePort,
  createTerminalToolPresentation,
} from "../extensions/terminal.js";
import { createSendMessageAgentTool } from "../src/tool.js";

const theme = {
  fg(_color: string, text: string) {
    return text;
  },
} as never;

function context(text: string, isError = false) {
  return {
    args: { text },
    toolCallId: "call-1",
    isError,
  } as never;
}

function visibleLines(component: { render(width: number): string[] }, width = 80) {
  return component.render(width)
    .map((line) => stripVTControlCharacters(line).trimEnd())
    .filter(Boolean);
}

test("terminal delivery receipts are deterministic for a repeated tool call", async () => {
  const send = createTerminalSendMessagePort();
  const first = await send({ toolCallId: "call-1", text: "第一条" });
  const replay = await send({ toolCallId: "call-1", text: "第一条" });
  assert.equal(first.messageId, "pi-terminal:call-1");
  assert.equal(first.idempotentReplay, false);
  assert.equal(replay.messageId, first.messageId);
  assert.equal(replay.idempotentReplay, true);
  assert.deepEqual(first.externalMessageIds, []);
});

test("terminal delivery refuses to claim delivery outside an active TUI session", async () => {
  let active = false;
  const send = createTerminalSendMessagePort(() => active);
  await assert.rejects(
    send({ toolCallId: "call-1", text: "不会被吞掉" }),
    /only available in interactive Pi mode/u,
  );
  active = true;
  assert.equal(
    (await send({ toolCallId: "call-1", text: "现在可以显示" })).messageId,
    "pi-terminal:call-1",
  );
});

test("terminal presentation hides pending calls and shows only confirmed message text", () => {
  const presentation = createTerminalToolPresentation();
  assert.equal(presentation.renderShell, "self");
  assert.deepEqual(
    visibleLines(presentation.renderCall?.({ text: "还在处理中" }, theme, {} as never) as never),
    [],
  );

  const partial = presentation.renderResult?.(
    {
      content: [{ type: "text", text: "pending receipt" }],
      details: { messageId: "pending", externalMessageIds: [], idempotentReplay: false },
    },
    { expanded: false, isPartial: true },
    theme,
    context("还在处理中"),
  );
  assert.deepEqual(visibleLines(partial as never), []);

  const success = presentation.renderResult?.(
    {
      content: [{ type: "text", text: '{"status":"delivered"}' }],
      details: { messageId: "pi-terminal:call-1", externalMessageIds: [], idempotentReplay: false },
    },
    { expanded: false, isPartial: false },
    theme,
    context("找到了，是登录回调地址不一致。"),
  );
  assert.deepEqual(visibleLines(success as never), ["找到了，是登录回调地址不一致。"]);
  assert.ok(visibleLines(success as never, 12).length > visibleLines(success as never, 80).length);
});

test("terminal presentation keeps failures visible instead of claiming delivery", () => {
  const presentation = createTerminalToolPresentation();
  const failure = presentation.renderResult?.(
    {
      content: [{ type: "text", text: "Operation aborted" }],
      details: { messageId: "failed", externalMessageIds: [], idempotentReplay: false },
    },
    { expanded: false, isPartial: false },
    theme,
    context("这条不应该显示", true),
  );
  assert.deepEqual(visibleLines(failure as never), ["Operation aborted"]);
});

test("terminal history requires a matching local receipt and preserves unverified result text", () => {
  const presentation = createTerminalToolPresentation();
  for (const details of [
    undefined,
    null,
    {},
    { messageId: "foreign:call-1", externalMessageIds: [], idempotentReplay: false },
    { messageId: "pi-terminal:another-call", externalMessageIds: [], idempotentReplay: false },
    { messageId: "pi-terminal:call-1", externalMessageIds: ["external-message"], idempotentReplay: false },
    { messageId: "pi-terminal:call-1", externalMessageIds: [] },
  ]) {
    const result = presentation.renderResult?.(
      { content: [{ type: "text", text: "Draft only. Not sent; please confirm first." }], details } as never,
      { expanded: false, isPartial: false },
      theme,
      context("This draft must not look delivered"),
    );
    assert.deepEqual(visibleLines(result as never), [
      "send_message · unverified result",
      "Draft only. Not sent; please confirm first.",
    ]);
  }
});

test("terminal history with missing or malformed arguments never throws or claims a bubble", () => {
  const presentation = createTerminalToolPresentation();
  for (const args of [undefined, null, {}, { text: null }, { text: 42 }, { text: " \n" }]) {
    const result = presentation.renderResult?.(
      {
        content: [{ type: "text", text: "Original result remains visible" }],
        details: { messageId: "pi-terminal:call-1", externalMessageIds: [], idempotentReplay: false },
      },
      { expanded: false, isPartial: false },
      theme,
      { args, toolCallId: "call-1", isError: false } as never,
    );
    assert.deepEqual(visibleLines(result as never), [
      "send_message · unverified result",
      "Original result remains visible",
    ]);
  }
});

test("Pi's real tool component preserves terminal messages live and after resume", async () => {
  const { ToolExecutionComponent, initTheme } = await loadPiRenderer();
  initTheme("dark", false);
  const definition = {
    ...createSendMessageAgentTool(
      createTerminalSendMessagePort(),
      {},
      "pi_terminal",
    ),
    ...createTerminalToolPresentation(),
  };
  const result = {
    content: [{ type: "text", text: '{"status":"delivered"}' }],
    details: {
      messageId: "pi-terminal:call-1",
      externalMessageIds: [],
      idempotentReplay: false,
    },
    isError: false,
  };

  const pending = new ToolExecutionComponent(
    "send_message",
    "call-1",
    { text: "第一条消息比较长\n第二条" },
    {},
    definition,
    { requestRender() {} },
    process.cwd(),
  );
  assert.deepEqual(visibleLines(pending), []);
  pending.markExecutionStarted();
  assert.deepEqual(visibleLines(pending), []);
  pending.updateResult(result);
  assert.deepEqual(visibleLines(pending), ["第一条消息比较长", "第二条"]);
  assert.equal(visibleLines(pending).join("\n").includes("send_message"), false);
  assert.equal(visibleLines(pending).join("\n").includes("delivered"), false);
  assert.ok(visibleLines(pending, 6).length > visibleLines(pending, 80).length);

  const restored = new ToolExecutionComponent(
    "send_message",
    "call-1",
    { text: "第一条消息比较长\n第二条" },
    {},
    definition,
    { requestRender() {} },
    process.cwd(),
  );
  restored.updateResult(result);
  assert.deepEqual(visibleLines(restored), ["第一条消息比较长", "第二条"]);

  const failed = new ToolExecutionComponent(
    "send_message",
    "call-2",
    { text: "不能假装发出去了" },
    {},
    definition,
    { requestRender() {} },
    process.cwd(),
  );
  failed.updateResult({
    content: [{ type: "text", text: "Operation aborted" }],
    details: undefined,
    isError: true,
  });
  assert.deepEqual(visibleLines(failed), ["Operation aborted"]);

  // Pi resumes a tool result using the currently registered same-name renderer.
  // A foreign historical tool's arguments must not replace its actual result.
  const foreignHistory = new ToolExecutionComponent(
    "send_message", "foreign-history", { text: "Unsent draft" }, {}, definition,
    { requestRender() {} }, process.cwd(),
  );
  foreignHistory.updateResult({
    content: [{ type: "text", text: "Not sent. Waiting for your confirmation." }],
    details: undefined,
    isError: false,
  });
  assert.deepEqual(visibleLines(foreignHistory), [
    "send_message · unverified result",
    "Not sent. Waiting for your confirmation.",
  ]);
});

async function loadPiRenderer(): Promise<{
  ToolExecutionComponent: new (...args: any[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    markExecutionStarted(): void;
    updateResult(result: unknown, isPartial?: boolean): void;
    render(width: number): string[];
  };
  initTheme(name?: string, watch?: boolean): void;
}> {
  const piEntry = import.meta.resolve("@earendil-works/pi-coding-agent");
  const componentUrl = new URL(
    "./modes/interactive/components/tool-execution.js",
    piEntry,
  ).href;
  const themeUrl = new URL("./modes/interactive/theme/theme.js", piEntry).href;
  const [componentModule, themeModule] = await Promise.all([
    import(componentUrl),
    import(themeUrl),
  ]);
  return {
    ToolExecutionComponent: componentModule.ToolExecutionComponent,
    initTheme: themeModule.initTheme,
  };
}
