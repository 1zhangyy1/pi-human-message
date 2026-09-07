import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import test from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerTerminalChatMode } from "../extensions/chat-mode.js";
import { PI_TERMINAL_TOOL_GUIDELINE } from "../src/pi-extension.js";

type Mode = "tui" | "rpc" | "json" | "print";
type Handler = (event: any, context: any) => unknown;
interface Renderable { render(width: number): string[] }
interface ToolComponent extends Renderable { updateResult(result: unknown): void }
interface Tool { name: string; promptGuidelines?: string[]; sourceInfo: { source: string } }
interface Notification { message: string; type?: string; sessionId: string }
interface Command { handler(args: string, context: any): unknown }
interface Shortcut { handler(context: any): unknown }
interface Entry { type: string; [key: string]: unknown }

const piEntry = import.meta.resolve("@earendil-works/pi-coding-agent");
const [toolModule, assistantModule, themeModule] = await Promise.all([
  import(new URL("./modes/interactive/components/tool-execution.js", piEntry).href),
  import(new URL("./modes/interactive/components/assistant-message.js", piEntry).href),
  import(new URL("./modes/interactive/theme/theme.js", piEntry).href),
]);
const ToolExecutionComponent = toolModule.ToolExecutionComponent as {
  new (...args: any[]): ToolComponent;
  prototype: Renderable;
};
const AssistantMessageComponent = assistantModule.AssistantMessageComponent as { prototype: Renderable };
themeModule.initTheme("dark", false);

function visible(component: Renderable) {
  return component.render(100).map((line) => stripVTControlCharacters(line).trim()).filter(Boolean);
}

function ordinaryTool(isError = false) {
  const component = new ToolExecutionComponent("read", "test-read", { path: "README.md" }, {}, undefined,
    { requestRender() {} }, process.cwd());
  component.updateResult({
    content: [{ type: "text", text: isError ? "Read failed" : "Raw execution detail" }],
    details: undefined,
    isError,
  });
  return component;
}

function viewEntry(mode: "chat" | "normal"): Entry {
  return { type: "custom", customType: "human-message-view", data: { mode } };
}

function assistant(text: string) {
  return { role: "assistant", content: [{ type: "text", text }], stopReason: "stop", timestamp: 0 };
}

function fakePi(initialMode: Mode = "tui", initialBranch: Entry[] = []) {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, Command>();
  const shortcuts = new Map<string, Shortcut>();
  const notifications: Notification[] = [];
  const statuses = new Map<string, string>();
  const appended: { customType: string; data: unknown }[] = [];
  const agentSends: unknown[] = [];
  let branch = [...initialBranch];
  let mode = initialMode;
  let sessionId = "session-1";
  let activeTools = ["read", "bash", "send_message"];
  let tools: Tool[] = [
    { name: "read", sourceInfo: { source: "builtin" } },
    { name: "bash", sourceInfo: { source: "builtin" } },
    { name: "send_message", promptGuidelines: [PI_TERMINAL_TOOL_GUIDELINE], sourceInfo: { source: "extension" } },
  ];
  const pi = {
    on(name: string, handler: Handler) {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
    },
    registerCommand(name: string, definition: Command) { commands.set(name, definition); },
    registerShortcut(key: string, definition: Shortcut) { shortcuts.set(key.toLowerCase(), definition); },
    getAllTools() { return tools; },
    getActiveTools() { return [...activeTools]; },
    appendEntry(customType: string, data: unknown) {
      appended.push({ customType, data });
      branch.push({ type: "custom", customType, data });
    },
    sendMessage(message: unknown) { agentSends.push(message); },
    sendUserMessage(message: unknown) { agentSends.push(message); },
  } as unknown as ExtensionAPI;
  function context() {
    const contextSessionId = sessionId;
    return {
      mode,
      hasUI: mode === "tui" || mode === "rpc",
      sessionManager: {
        getBranch() { return [...branch]; },
        getSessionId() { return contextSessionId; },
        getSessionFile() { return `/tmp/${contextSessionId}.jsonl`; },
        getEntries() { return [...branch]; },
      },
      ui: {
        notify(message: string, type?: string) {
          notifications.push({ message, ...(type === undefined ? {} : { type }), sessionId: contextSessionId });
        },
        setStatus(key: string, value?: string) {
          if (value === undefined) statuses.delete(key);
          else statuses.set(key, value);
        },
        requestRender() {},
        theme: { fg(_color: string, text: string) { return text; } },
      },
      isIdle() { return true; },
    };
  }
  function dispatch(name: string, event: Record<string, unknown> = {}) {
    const ctx = context();
    return (handlers.get(name) ?? []).map((handler) => handler({ type: name, ...event }, ctx));
  }
  registerTerminalChatMode(pi, () => "delivery is active in this terminal");
  return {
    handlers, commands, shortcuts, notifications, statuses, appended, agentSends,
    async emit(name: string, event: Record<string, unknown> = {}) { await Promise.all(dispatch(name, event)); },
    dispatch,
    async command(args: string) {
      const command = commands.get("human-message");
      assert.ok(command, "human-message command must be registered");
      await command.handler(args, context());
    },
    async toggle() {
      const shortcut = shortcuts.get("f8");
      assert.ok(shortcut, "F8 shortcut must be registered");
      await shortcut.handler(context());
    },
    setTools(next: Tool[]) { tools = next; },
    setActiveTools(next: string[]) { activeTools = next; },
    setSession(nextId: string, nextBranch: Entry[], nextMode: Mode = mode) {
      sessionId = nextId;
      branch = [...nextBranch];
      mode = nextMode;
    },
    async shutdown() { await Promise.all(dispatch("session_shutdown")); },
  };
}

function assertChat() { assert.deepEqual(visible(ordinaryTool()), []); }
function assertNormal() { assert.match(visible(ordinaryTool()).join("\n"), /Raw execution detail/u); }

test("a new interactive session defaults to chat with one status command and F8 switch", async () => {
  const calls = fakePi();
  const toolRender = ToolExecutionComponent.prototype.render;
  const assistantRender = AssistantMessageComponent.prototype.render;
  try {
    assert.deepEqual([...calls.commands.keys()], ["human-message"]);
    assert.ok(calls.shortcuts.has("f8"));
    await calls.emit("session_start", { reason: "new" });
    assertChat();
    assert.ok(calls.statuses.size > 0);
    await calls.command("");
    assert.match(calls.notifications.at(-1)?.message ?? "", /delivery is active in this terminal/u);
    assertChat();
    await calls.command("status");
    assertChat();
  } finally {
    await calls.shutdown();
    assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
  }
});

test("normal and chat commands restore immediately and persist only the view preference", async () => {
  const calls = fakePi();
  const toolRender = ToolExecutionComponent.prototype.render;
  const assistantRender = AssistantMessageComponent.prototype.render;
  try {
    await calls.emit("session_start", { reason: "new" });
    await calls.command("normal");
    assertNormal();
    assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
    assert.deepEqual(calls.appended.at(-1), { customType: "human-message-view", data: { mode: "normal" } });
    await calls.command("chat");
    assertChat();
    assert.deepEqual(calls.appended.at(-1), { customType: "human-message-view", data: { mode: "chat" } });
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

test("F8 toggles chat and normal without touching the agent conversation", async () => {
  const calls = fakePi();
  try {
    await calls.emit("session_start");
    assertChat();
    await calls.toggle();
    assertNormal();
    await calls.toggle();
    assertChat();
    assert.deepEqual(calls.appended.map((entry) => entry.data), [{ mode: "normal" }, { mode: "chat" }]);
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

test("restoring a session uses the latest view preference from its current branch", async () => {
  const calls = fakePi("tui", [viewEntry("chat"), viewEntry("normal")]);
  try {
    await calls.emit("session_start", { reason: "resume" });
    assertNormal();
    assert.deepEqual(calls.appended, []);
    calls.setSession("other-session", [viewEntry("normal"), viewEntry("chat")]);
    await calls.emit("session_start", { reason: "switch" });
    assertChat();
    assert.deepEqual(calls.appended, []);
  } finally {
    await calls.shutdown();
  }
});

test("a fresh session does not inherit normal view from the previous session", async () => {
  const calls = fakePi("tui", [viewEntry("normal")]);
  try {
    await calls.emit("session_start", { reason: "resume" });
    assertNormal();
    calls.setSession("new-session", []);
    await calls.emit("session_start", { reason: "new" });
    assertChat();
  } finally {
    await calls.shutdown();
  }
});

test("navigating the session tree restores the selected branch preference and history protection", async () => {
  const calls = fakePi();
  try {
    await calls.emit("session_start");
    assertChat();
    calls.setSession("session-1", [viewEntry("normal")]);
    await calls.emit("session_tree");
    assertNormal();
    calls.setSession("session-1", [viewEntry("chat")]);
    await calls.emit("session_tree");
    assertChat();
    calls.setSession("session-1", [
      { type: "message", message: assistant("This branch contains a real earlier answer") },
      viewEntry("chat"),
    ]);
    await calls.emit("session_tree");
    assertNormal();
  } finally {
    await calls.shutdown();
  }
});

test("legacy ordinary assistant history stays visible and cannot be silently hidden by chat", async () => {
  const calls = fakePi("tui", [
    { type: "message", message: assistant("Earlier answer that never used send_message") },
    viewEntry("chat"),
  ]);
  try {
    await calls.emit("session_start", { reason: "resume" });
    assertNormal();
    await calls.command("chat");
    assertNormal();
    assert.match(calls.notifications.map((notification) => notification.message).join("\n"), /\/new/u);
    assert.equal(calls.appended.some((entry) => (entry.data as { mode: string }).mode === "chat"), false);
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

for (const stopReason of ["error", "aborted", "length"] as const) {
  test(`historical assistant ${stopReason} stops prevent chat activation before anything is rendered`, async () => {
    const calls = fakePi("tui", [
      { type: "message", message: { ...assistant(""), stopReason } },
      viewEntry("chat"),
    ]);
    const toolRender = ToolExecutionComponent.prototype.render;
    const assistantRender = AssistantMessageComponent.prototype.render;
    try {
      await calls.emit("session_start", { reason: "resume" });
      assert.equal(ToolExecutionComponent.prototype.render, toolRender);
      assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
      await calls.command("chat");
      assert.equal(ToolExecutionComponent.prototype.render, toolRender);
      assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
      assertNormal();
      assert.match(calls.notifications.map((notification) => notification.message).join("\n"), /\/new/u);
      assert.equal(calls.appended.some((entry) => (entry.data as { mode: string }).mode === "chat"), false);
      assert.deepEqual(calls.agentSends, []);
    } finally {
      await calls.shutdown();
    }
  });
}

test("a historical tool failure prevents chat activation before the old tool is rendered", async () => {
  const calls = fakePi("tui", [
    { type: "message", message: {
      role: "toolResult", toolName: "bash", toolCallId: "failed-tool", content: [{ type: "text", text: "Operation failed" }], isError: true,
    } },
    viewEntry("chat"),
  ]);
  const toolRender = ToolExecutionComponent.prototype.render;
  const assistantRender = AssistantMessageComponent.prototype.render;
  try {
    await calls.emit("session_start", { reason: "resume" });
    assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
    await calls.command("chat");
    assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
    assertNormal();
    assert.match(calls.notifications.map((notification) => notification.message).join("\n"), /\/new/u);
    assert.equal(calls.appended.some((entry) => (entry.data as { mode: string }).mode === "chat"), false);
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

test("whitespace and tool-call-only assistant history do not block chat restoration", async () => {
  const calls = fakePi("tui", [
    { type: "message", message: assistant(" \n ") },
    { type: "message", message: {
      role: "assistant", content: [{ type: "toolCall", id: "saved-message", name: "send_message", arguments: { text: "Already delivered" } }],
      stopReason: "toolUse",
    } },
    { type: "message", message: { role: "toolResult", toolName: "send_message", toolCallId: "saved-message", content: [{ type: "text", text: "delivered" }], isError: false } },
    viewEntry("chat"),
  ]);
  try {
    await calls.emit("session_start", { reason: "resume" });
    assertChat();
  } finally {
    await calls.shutdown();
  }
});

for (const mode of ["rpc", "json", "print"] as const) {
  test(`chat display remains inert in ${mode} mode, even after chat command or F8`, async () => {
    const calls = fakePi(mode);
    const toolRender = ToolExecutionComponent.prototype.render;
    const assistantRender = AssistantMessageComponent.prototype.render;
    try {
      await calls.emit("session_start");
      await calls.command("chat");
      await calls.toggle();
      await calls.emit("before_agent_start", { systemPrompt: "base" });
      assertNormal();
      assert.equal(ToolExecutionComponent.prototype.render, toolRender);
      assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
      assert.deepEqual(calls.agentSends, []);
    } finally {
      await calls.shutdown();
    }
  });
}

test("losing send_message ownership before a turn restores the normal transcript", async () => {
  const calls = fakePi();
  try {
    await calls.emit("session_start");
    assertChat();
    calls.setTools([{ name: "send_message", promptGuidelines: ["Another extension owns this tool"], sourceInfo: { source: "extension" } }]);
    await calls.emit("before_agent_start", { systemPrompt: "base" });
    assertNormal();
    await calls.command("chat");
    assertNormal();
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

test("disabling send_message before a turn restores the normal transcript", async () => {
  const calls = fakePi();
  try {
    await calls.emit("session_start");
    assertChat();
    calls.setActiveTools(["read", "bash"]);
    await calls.emit("before_agent_start", { systemPrompt: "base" });
    assertNormal();
    await calls.command("chat");
    assertNormal();
  } finally {
    await calls.shutdown();
  }
});

test("unexpected ordinary assistant output becomes visible when the turn settles without rerunning work", async () => {
  const calls = fakePi();
  try {
    await calls.emit("session_start");
    await calls.emit("before_agent_start", { systemPrompt: "base" });
    await calls.emit("message_end", { message: assistant("A real answer outside send_message") });
    assertChat();
    await calls.emit("agent_settled");
    assertNormal();
    assert.ok(calls.notifications.length > 0);
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

test("normal tool-call messages and empty final output do not trigger a false fallback", async () => {
  const calls = fakePi();
  try {
    await calls.emit("session_start");
    await calls.emit("before_agent_start", { systemPrompt: "base" });
    await calls.emit("message_end", { message: {
      role: "assistant", content: [{ type: "toolCall", id: "send-1", name: "send_message", arguments: { text: "Done" } }], stopReason: "toolUse",
    } });
    await calls.emit("message_end", { message: {
      role: "toolResult", toolName: "read", content: [{ type: "text", text: "Non-empty tool output is not assistant speech" }], isError: false,
    } });
    await calls.emit("message_end", { message: assistant(" \n") });
    await calls.emit("agent_settled");
    assertChat();
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

test("an unfinished ordinary-text marker cannot carry into a fresh session", async () => {
  const calls = fakePi();
  try {
    await calls.emit("session_start");
    await calls.emit("before_agent_start", { systemPrompt: "base" });
    await calls.emit("message_end", { message: assistant("Previous session's unfinished response") });
    calls.setSession("new-session", []);
    await calls.emit("session_start", { reason: "new" });
    await calls.emit("agent_settled");
    assertChat();
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

test("a tool rendering failure restores normal mode and reports the fallback without sending to the agent", async () => {
  const calls = fakePi();
  try {
    await calls.emit("session_start");
    assertChat();
    assert.match(visible(ordinaryTool(true)).join("\n"), /Read failed/u);
    await Promise.resolve();
    assertNormal();
    assert.ok(calls.notifications.length > 0);
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

test("a queued fallback notification cannot leak into the next session", async () => {
  const calls = fakePi();
  try {
    await calls.emit("session_start");
    visible(ordinaryTool(true));
    calls.setSession("session-2", []);
    const switched = calls.dispatch("session_start", { reason: "new" });
    await Promise.all(switched);
    await Promise.resolve();
    assertChat();
    assert.equal(calls.notifications.filter((notification) => notification.sessionId === "session-2").length, 0);
    assert.deepEqual(calls.agentSends, []);
  } finally {
    await calls.shutdown();
  }
});

test("shutting down a session discards pending fallback UI updates and restores prototypes", async () => {
  const calls = fakePi();
  const toolRender = ToolExecutionComponent.prototype.render;
  const assistantRender = AssistantMessageComponent.prototype.render;
  try {
    await calls.emit("session_start");
    visible(ordinaryTool(true));
    const shuttingDown = calls.dispatch("session_shutdown");
    const before = calls.notifications.length;
    await Promise.all(shuttingDown);
    await Promise.resolve();
    assert.equal(calls.notifications.length, before);
    assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
  } finally {
    await calls.shutdown();
  }
});
