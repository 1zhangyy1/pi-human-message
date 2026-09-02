import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import installedExtension, {
  createInstalledHumanMessageExtension,
} from "../extensions/index.js";

test("package declares a discoverable Pi extension", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { keywords?: string[]; pi?: { extensions?: string[] } };
  assert.equal(packageJson.keywords?.includes("pi-package"), true);
  assert.deepEqual(packageJson.pi?.extensions, ["./extensions/index.ts"]);
  assert.equal(typeof installedExtension, "function");
});

test("installed extension stays inert without a delivery endpoint", () => {
  const calls = createFakePi();
  createInstalledHumanMessageExtension({})(calls.pi);
  assert.deepEqual(calls.tools, []);
  assert.deepEqual(calls.commands, ["human-message"]);
  assert.equal(calls.events.includes("session_start"), true);
  assert.equal(calls.events.includes("before_agent_start"), false);
});

test("installed extension activates the core against a configured webhook", () => {
  const calls = createFakePi();
  createInstalledHumanMessageExtension({
    PI_HUMAN_MESSAGE_WEBHOOK_URL: "https://delivery.example.test/send",
  })(calls.pi);
  assert.deepEqual(calls.tools, ["send_message"]);
  assert.deepEqual(calls.commands, ["human-message"]);
  assert.equal(calls.events.includes("before_agent_start"), true);
});

function createFakePi() {
  const tools: string[] = [];
  const commands: string[] = [];
  const events: string[] = [];
  const pi = {
    registerTool(tool: { name: string }) {
      tools.push(tool.name);
    },
    registerCommand(name: string) {
      commands.push(name);
    },
    on(name: string) {
      events.push(name);
    },
  } as never;
  return { pi, tools, commands, events };
}
