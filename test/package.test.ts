import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import installedExtension, {
  createInstalledHumanMessageExtension,
} from "../extensions/index.js";
import {
  HUMAN_MESSAGE_TURN_REMINDER,
  PI_TERMINAL_TURN_REMINDER,
} from "../src/index.js";

const cleanups: Array<() => Promise<void>> = [];
test.afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

test("package declares a discoverable Pi extension", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    files?: string[];
    keywords?: string[];
    peerDependencies?: Record<string, string>;
    pi?: { extensions?: string[] };
  };
  assert.equal(packageJson.keywords?.includes("pi-package"), true);
  assert.equal(packageJson.files?.includes("README.md"), true);
  assert.equal(packageJson.files?.includes("README.zh-CN.md"), true);
  assert.deepEqual(packageJson.pi?.extensions, ["./extensions/index.ts"]);
  assert.equal(packageJson.peerDependencies?.["@earendil-works/pi-tui"], "*");
  assert.equal(typeof installedExtension, "function");
});

test("installed extension activates terminal delivery only in interactive Pi", async () => {
  const calls = createFakePi();
  createInstalledHumanMessageExtension({})(calls.pi);
  assert.equal(calls.tools.length, 1);
  assert.deepEqual(calls.commands, ["human-message"]);
  assert.equal(calls.events.includes("session_start"), true);
  await calls.start("tui", true);
  assert.deepEqual(calls.tools.map((tool) => tool.name), ["send_message"]);
  assert.deepEqual(calls.activeTools, ["read", "bash", "send_message"]);
  assert.equal(calls.events.includes("before_agent_start"), true);
  const result = await calls.runBeforeAgentStart("tui", true, { systemPrompt: "base" });
  assert.match(result?.systemPrompt ?? "", /Pi also displays ordinary assistant text/u);
  assert.deepEqual(result?.message, {
    customType: "human-message-turn-reminder",
    content: PI_TERMINAL_TURN_REMINDER,
    display: false,
  });
  assert.equal(calls.tools[0]?.renderShell, "self");

  await calls.start("tui", true);
  assert.equal(calls.tools.length, 1);
});

test("installed extension stays inert in print, JSON, and RPC modes", async () => {
  for (const [mode, hasUI] of [
    ["print", false],
    ["json", false],
    ["rpc", true],
  ] as const) {
    const calls = createFakePi();
    createInstalledHumanMessageExtension({})(calls.pi);
    await calls.start(mode, hasUI);
    assert.deepEqual(calls.activeTools, ["read", "bash"], mode);
    assert.equal(calls.events.includes("before_agent_start"), true, mode);
    assert.equal(
      await calls.runBeforeAgentStart(mode, hasUI, { systemPrompt: "base" }),
      undefined,
      mode,
    );
  }
});

test("installed extension activates the core and refreshes its hidden turn reminder", async () => {
  const calls = createFakePi();
  createInstalledHumanMessageExtension({
    PI_HUMAN_MESSAGE_WEBHOOK_URL: "https://delivery.example.test/send",
  })(calls.pi);
  assert.deepEqual(calls.tools.map((tool) => tool.name), ["send_message"]);
  assert.deepEqual(calls.commands, ["human-message"]);
  assert.equal(calls.events.includes("before_agent_start"), true);
  const result = await calls.runBeforeAgentStart("print", false, { systemPrompt: "base" });
  assert.match(result?.systemPrompt ?? "", /base/u);
  assert.deepEqual(result?.message, {
    customType: "human-message-turn-reminder",
    content: HUMAN_MESSAGE_TURN_REMINDER,
    display: false,
  });
  assert.match(calls.tools[0]?.description ?? "", /Plain assistant text is private/u);
  assert.equal(calls.tools[0]?.renderShell, undefined);
});

test("an invalid explicit Webhook never falls back to terminal delivery", async () => {
  const calls = createFakePi();
  createInstalledHumanMessageExtension({
    PI_HUMAN_MESSAGE_WEBHOOK_URL: "ftp://delivery.example.test/send",
  })(calls.pi);
  await calls.start("tui", true);
  assert.deepEqual(calls.tools, []);
});

test("a different send_message owner is neither disabled nor given Human Message prompts", async () => {
  for (const environment of [
    {},
    { PI_HUMAN_MESSAGE_WEBHOOK_URL: "https://delivery.example.test/send" },
  ]) {
    const calls = createFakePi([{
      name: "send_message",
      promptGuidelines: ["Owned by another extension"],
    }]);
    createInstalledHumanMessageExtension(environment)(calls.pi);
    await calls.start("tui", true);
    assert.deepEqual(calls.activeTools, ["read", "bash", "send_message"]);
    assert.equal(
      await calls.runBeforeAgentStart("tui", true, { systemPrompt: "base" }),
      undefined,
    );
  }
});

interface FakeTool {
  name: string;
  description?: string;
  promptGuidelines?: string[];
  renderShell?: "default" | "self";
}

function createFakePi(initialTools: FakeTool[] = []) {
  const tools: FakeTool[] = [...initialTools];
  let activeTools: string[] = [
    "read",
    "bash",
    ...initialTools.map((tool) => tool.name),
  ];
  const commands: string[] = [];
  const events: string[] = [];
  const handlers = new Map<string, Array<(event: unknown, context: unknown) => unknown>>();
  let beforeAgentStart: ((event: { systemPrompt: string }, context: unknown) => Promise<{
    systemPrompt?: string;
    message?: { customType: string; content: string; display: boolean };
  }>) | undefined;
  const pi = {
    registerTool(tool: FakeTool) {
      tools.push(tool);
      if (!activeTools.includes(tool.name)) activeTools.push(tool.name);
    },
    registerCommand(name: string) {
      commands.push(name);
    },
    registerShortcut() {},
    appendEntry() {},
    on(name: string, handler: unknown) {
      events.push(name);
      const existing = handlers.get(name) ?? [];
      existing.push(handler as (event: unknown, context: unknown) => unknown);
      handlers.set(name, existing);
      if (name === "before_agent_start") {
        beforeAgentStart = handler as typeof beforeAgentStart;
      }
    },
    getActiveTools() {
      return [...activeTools];
    },
    setActiveTools(names: string[]) {
      activeTools = [...names];
    },
    getAllTools() {
      return tools.map((tool) => ({
        ...tool,
        parameters: {},
        sourceInfo: { path: "extension.ts", source: "test", scope: "temporary", origin: "top-level" },
      }));
    },
  } as never;
  cleanups.push(async () => {
    for (const handler of handlers.get("session_shutdown") ?? []) await handler({}, {});
  });
  return {
    pi,
    tools,
    commands,
    events,
    get activeTools() {
      return [...activeTools];
    },
    async start(mode: "tui" | "rpc" | "json" | "print", hasUI: boolean) {
      const context = {
        mode,
        hasUI,
        sessionManager: { getBranch: () => [] },
        ui: { notify() {}, setStatus() {} },
      };
      for (const handler of handlers.get("session_start") ?? []) {
        await handler({ type: "session_start", reason: "new" }, context);
      }
    },
    async runBeforeAgentStart(
      mode: "tui" | "rpc" | "json" | "print",
      hasUI: boolean,
      event: { systemPrompt: string },
    ) {
      return beforeAgentStart?.(event, {
        mode,
        hasUI,
        sessionManager: { getBranch: () => [] },
        ui: { notify() {}, setStatus() {} },
      });
    },
  };
}
