import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import test from "node:test";

import { Text } from "@earendil-works/pi-tui";

import { createTerminalChatDisplay } from "../extensions/chat-display.js";
import {
  createTerminalSendMessagePort,
  createTerminalToolPresentation,
} from "../extensions/terminal.js";
import { PI_TERMINAL_TOOL_GUIDELINE } from "../src/pi-extension.js";
import { createSendMessageAgentTool } from "../src/tool.js";

interface Renderable {
  render(width: number): string[];
}

interface ToolComponent extends Renderable {
  markExecutionStarted(): void;
  updateResult(result: unknown, isPartial?: boolean): void;
  result: unknown;
  args: unknown;
}

interface AssistantComponent extends Renderable {
  updateContent(message: unknown, isStreaming?: boolean): void;
  lastMessage: unknown;
}

type ComponentConstructor<T> = {
  new (...args: any[]): T;
  prototype: T;
};

const piEntry = import.meta.resolve("@earendil-works/pi-coding-agent");
const [toolModule, assistantModule, userModule, themeModule] = await Promise.all([
  import(new URL("./modes/interactive/components/tool-execution.js", piEntry).href),
  import(new URL("./modes/interactive/components/assistant-message.js", piEntry).href),
  import(new URL("./modes/interactive/components/user-message.js", piEntry).href),
  import(new URL("./modes/interactive/theme/theme.js", piEntry).href),
]);
const ToolExecutionComponent = toolModule.ToolExecutionComponent as ComponentConstructor<ToolComponent>;
const AssistantMessageComponent = assistantModule.AssistantMessageComponent as ComponentConstructor<AssistantComponent>;
const UserMessageComponent = userModule.UserMessageComponent as ComponentConstructor<Renderable>;
themeModule.initTheme("dark", false);

function visible(component: Renderable, width = 100): string[] {
  return component.render(width)
    .map((line) => stripVTControlCharacters(line).trim())
    .filter(Boolean);
}

function textResult(text: string, isError = false) {
  return { content: [{ type: "text", text }], details: undefined, isError };
}

function tool(name: string, id = `call-${name}`, definition?: unknown) {
  return new ToolExecutionComponent(
    name,
    id,
    { command: "pwd", path: "README.md", text: "Delivered message" },
    {},
    definition,
    { requestRender() {} },
    process.cwd(),
  );
}

function ownMessage(text: string, id: string) {
  return new ToolExecutionComponent(
    "send_message",
    id,
    { text },
    {},
    {
      ...createSendMessageAgentTool(createTerminalSendMessagePort(), {}, "pi_terminal"),
      ...createTerminalToolPresentation(),
      promptGuidelines: [PI_TERMINAL_TOOL_GUIDELINE],
    },
    { requestRender() {} },
    process.cwd(),
  );
}

function delivered(id: string) {
  return {
    content: [{ type: "text", text: '{"status":"delivered"}' }],
    details: {
      messageId: `pi-terminal:${id}`,
      externalMessageIds: [],
      idempotentReplay: false,
    },
    isError: false,
  };
}

function assistantMessage(text: string, stopReason = "stop", errorMessage?: string) {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-responses",
    provider: "openai",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    timestamp: 0,
    ...(errorMessage === undefined ? {} : { errorMessage }),
  };
}

test("chat display hides pending and completed ordinary tools without changing their data", () => {
  const display = createTerminalChatDisplay();
  try {
    assert.equal(display.enable(), true);
    for (const name of ["read", "bash", "notion_search", "third_party_tool"]) {
      const component = tool(name);
      const args = component.args;
      assert.deepEqual(visible(component), [], `${name} pending call`);
      component.markExecutionStarted();
      assert.deepEqual(visible(component), [], `${name} running call`);
      const result = textResult(`Raw ${name} output`);
      const snapshot = structuredClone(result);
      component.updateResult(result, true);
      assert.deepEqual(visible(component), [], `${name} partial result`);
      component.updateResult(result);
      assert.deepEqual(visible(component), [], `${name} complete result`);
      assert.equal(component.result, result);
      assert.equal(component.args, args);
      assert.deepEqual(result, snapshot);
    }
  } finally {
    display.dispose();
  }
});

test("chat display shows each confirmed Human Message immediately, including restored deliveries", () => {
  const display = createTerminalChatDisplay();
  const first = ownMessage("找到了，回调地址没有对上。", "first");
  const second = ownMessage("已经修好，可以再试一次。", "second");
  try {
    assert.equal(display.enable(), true);
    assert.deepEqual(visible(first), []);
    first.markExecutionStarted();
    first.updateResult(delivered("first"), true);
    assert.deepEqual(visible(first), []);
    first.updateResult(delivered("first"));
    assert.deepEqual(visible(first), ["找到了，回调地址没有对上。"]);
    assert.deepEqual(visible(second), []);
    second.updateResult(delivered("second"));
    assert.deepEqual(visible(first), ["找到了，回调地址没有对上。"]);
    assert.deepEqual(visible(second), ["已经修好，可以再试一次。"]);

    const restored = ownMessage("找到了，回调地址没有对上。", "first");
    restored.updateResult(delivered("first"));
    assert.deepEqual(visible(restored), visible(first));
    assert.ok(visible(first, 12).length > visible(first).length);
    assert.equal(visible(first).join("\n").includes("delivered"), false);
  } finally {
    display.dispose();
  }
});

test("chat display does not mistake a third-party send_message tool for Human Message", () => {
  const display = createTerminalChatDisplay();
  try {
    assert.equal(display.enable(), true);
    for (const definition of [undefined, { promptGuidelines: ["A third-party delivery tool"] }]) {
      const component = tool("send_message", "third-party", definition);
      component.updateResult(textResult("Private third-party execution result"));
      assert.deepEqual(visible(component), []);
    }
  } finally {
    display.dispose();
  }
});

test("same-name history with the current renderer must still have a confirmed local receipt", () => {
  for (const details of [undefined, { ...delivered("other-call").details }]) {
    const display = createTerminalChatDisplay();
    const restored = ownMessage("An unsent historical draft", "historical-call");
    try {
      assert.equal(display.enable(), true);
      restored.updateResult({
        content: [{ type: "text", text: "Not sent; waiting for confirmation." }],
        details,
        isError: false,
      });
      const lines = visible(restored);
      assert.equal(display.isEnabled(), false);
      assert.deepEqual(lines, ["send_message · unverified result", "Not sent; waiting for confirmation."]);
      assert.match(display.getReason() ?? "", /not a confirmed terminal delivery/u);
    } finally {
      display.dispose();
    }
  }
});

test("a matching receipt with missing message arguments fails open instead of showing an empty bubble", () => {
  const display = createTerminalChatDisplay();
  const restored = ownMessage("", "missing-args");
  restored.args = undefined;
  try {
    assert.equal(display.enable(), true);
    restored.updateResult(delivered("missing-args"));
    assert.match(visible(restored).join("\n"), /unverified result/u);
    assert.equal(display.isEnabled(), false);
  } finally {
    display.dispose();
  }
});

test("pending custom tool renderers fail open so interaction prompts cannot be hidden", () => {
  const reasons: string[] = [];
  const display = createTerminalChatDisplay({ onFallback: (reason) => reasons.push(reason) });
  try {
    assert.equal(display.enable(), true);
    const component = tool("approval_tool", "approval", {
      renderCall: () => new Text("Approve external action?", 0, 0),
    });
    assert.match(visible(component).join("\n"), /Approve external action/u);
    assert.equal(display.isEnabled(), false);
    assert.equal(reasons.length, 1);
  } finally {
    display.dispose();
  }
});

test("only explicitly trusted custom tool renderers may be hidden while pending", () => {
  const display = createTerminalChatDisplay({ canHideTool: (name) => name === "read" });
  try {
    assert.equal(display.enable(), true);
    const builtin = tool("read", "builtin", {
      renderCall: () => new Text("read README.md", 0, 0),
    });
    assert.deepEqual(visible(builtin), []);
    assert.equal(display.isEnabled(), true);
    const untrusted = tool("untrusted", "untrusted", {
      renderResult: () => new Text("Interactive renderer", 0, 0),
    });
    untrusted.updateResult(textResult("Awaiting confirmation"), true);
    assert.match(visible(untrusted).join("\n"), /Interactive renderer/u);
    assert.equal(display.isEnabled(), false);
  } finally {
    display.dispose();
  }
});

test("completed custom tool renderers remain visible because their results can still contain interactions", () => {
  const display = createTerminalChatDisplay();
  try {
    assert.equal(display.enable(), true);
    const completed = tool("third_party", "completed", {
      renderCall: () => new Text("Third-party completed tool", 0, 0),
      renderResult: () => new Text("Result ready. Open / Confirm / Cancel", 0, 0),
    });
    completed.updateResult(textResult("Complete"));
    assert.match(visible(completed).join("\n"), /Open \/ Confirm \/ Cancel/u);
    assert.equal(display.isEnabled(), false);
  } finally {
    display.dispose();
  }
});

test("explicitly trusted builtin renderers can still hide completed ordinary results", () => {
  const display = createTerminalChatDisplay({ canHideTool: (name) => name === "read" });
  try {
    assert.equal(display.enable(), true);
    const completed = tool("read", "completed-builtin", {
      renderCall: () => new Text("read README.md", 0, 0),
      renderResult: () => new Text("Confirmed ordinary output", 0, 0),
    });
    completed.updateResult(textResult("Complete"));
    assert.deepEqual(visible(completed), []);
    assert.equal(display.isEnabled(), true);
  } finally {
    display.dispose();
  }
});

test("chat display hides ordinary assistant text and thinking without modifying the original message", () => {
  const display = createTerminalChatDisplay();
  const message = {
    ...assistantMessage("This is ordinary assistant output, not a delivery."),
    content: [
      { type: "thinking", thinking: "Private working notes" },
      { type: "text", text: "This is ordinary assistant output, not a delivery." },
    ],
  };
  const snapshot = structuredClone(message);
  const component = new AssistantMessageComponent(message);
  const original = visible(component);
  assert.ok(original.length > 0);
  try {
    assert.equal(display.enable(), true);
    assert.deepEqual(visible(component), []);
    component.updateContent(message, true);
    assert.deepEqual(visible(component), []);
    assert.equal(component.lastMessage, message);
    assert.deepEqual(message, snapshot);
    display.disable();
    assert.deepEqual(visible(component), original);
  } finally {
    display.dispose();
  }
});

test("chat display leaves user messages and unrelated confirmation components untouched", () => {
  const display = createTerminalChatDisplay();
  const user = new UserMessageComponent("帮我看看这个项目是做什么的。");
  const confirmation = new Text("Allow this action? Yes / No", 0, 0);
  const userRender = UserMessageComponent.prototype.render;
  const textRender = Text.prototype.render;
  const userBefore = visible(user);
  const confirmationBefore = visible(confirmation);
  try {
    assert.equal(display.enable(), true);
    assert.equal(UserMessageComponent.prototype.render, userRender);
    assert.equal(Text.prototype.render, textRender);
    assert.deepEqual(visible(user), userBefore);
    assert.deepEqual(visible(confirmation), confirmationBefore);
  } finally {
    display.dispose();
  }
});

test("disabling chat display restores both existing components and components created while enabled", () => {
  const display = createTerminalChatDisplay();
  const before = tool("read", "before");
  before.updateResult(textResult("Existing persisted output"));
  const expectedBefore = visible(before);
  const toolRender = ToolExecutionComponent.prototype.render;
  const assistantRender = AssistantMessageComponent.prototype.render;
  try {
    assert.equal(display.enable(), true);
    const during = tool("bash", "during");
    during.updateResult(textResult("Output generated while quiet"));
    const assistant = new AssistantMessageComponent(assistantMessage("Original assistant response"));
    assert.deepEqual(visible(before), []);
    assert.deepEqual(visible(during), []);
    assert.deepEqual(visible(assistant), []);
    display.disable();
    assert.equal(display.isEnabled(), false);
    assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
    assert.deepEqual(visible(before), expectedBefore);
    assert.match(visible(during).join("\n"), /Output generated while quiet/u);
    assert.match(visible(assistant).join("\n"), /Original assistant response/u);
  } finally {
    display.dispose();
  }
});

test("repeated enable, disable and dispose never stack render wrappers", () => {
  const display = createTerminalChatDisplay();
  const toolRender = ToolExecutionComponent.prototype.render;
  const assistantRender = AssistantMessageComponent.prototype.render;
  try {
    assert.equal(display.enable(), true);
    const patchedTool = ToolExecutionComponent.prototype.render;
    const patchedAssistant = AssistantMessageComponent.prototype.render;
    assert.equal(display.enable(), true);
    assert.equal(ToolExecutionComponent.prototype.render, patchedTool);
    assert.equal(AssistantMessageComponent.prototype.render, patchedAssistant);
    display.disable();
    display.disable();
    assert.equal(display.enable(), true);
    display.dispose();
    display.dispose();
    assert.equal(display.isEnabled(), false);
    assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
  } finally {
    display.dispose();
  }
});

test("an unknown Pi version refuses to patch either prototype", () => {
  const reasons: string[] = [];
  const display = createTerminalChatDisplay({ version: "999.0.0", onFallback: (reason) => reasons.push(reason) });
  const toolRender = ToolExecutionComponent.prototype.render;
  const assistantRender = AssistantMessageComponent.prototype.render;
  try {
    assert.equal(display.enable(), false);
    assert.equal(display.isEnabled(), false);
    assert.ok(display.getReason());
    assert.equal(reasons.length, 1);
    assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
  } finally {
    display.dispose();
  }
});

test("a second chat display never takes ownership of an already active display", () => {
  const first = createTerminalChatDisplay();
  const second = createTerminalChatDisplay();
  try {
    assert.equal(first.enable(), true);
    const firstToolRender = ToolExecutionComponent.prototype.render;
    const firstAssistantRender = AssistantMessageComponent.prototype.render;
    assert.equal(second.enable(), false);
    second.dispose();
    assert.equal(ToolExecutionComponent.prototype.render, firstToolRender);
    assert.equal(AssistantMessageComponent.prototype.render, firstAssistantRender);
    assert.equal(first.isEnabled(), true);
  } finally {
    second.dispose();
    first.dispose();
  }
});

for (const field of ["toolName", "result", "toolDefinition"] as const) {
  test(`an unfamiliar tool component missing ${field} falls back without hiding its output`, () => {
    const reasons: string[] = [];
    const display = createTerminalChatDisplay({ onFallback: (reason) => reasons.push(reason) });
    const component = tool("read", "unknown-shape");
    component.updateResult(textResult("Original visible output"));
    const original = visible(component);
    try {
      assert.equal(display.enable(), true);
      Reflect.deleteProperty(component, field);
      assert.deepEqual(visible(component), original);
      assert.equal(display.isEnabled(), false);
      assert.equal(reasons.length, 1);
    } finally {
      display.dispose();
    }
  });
}

test("an unfamiliar assistant component without lastMessage falls back to its original display", () => {
  const display = createTerminalChatDisplay();
  const component = new AssistantMessageComponent(assistantMessage("A recoverable answer"));
  const original = visible(component);
  try {
    assert.equal(display.enable(), true);
    Reflect.deleteProperty(component, "lastMessage");
    assert.deepEqual(visible(component), original);
    assert.equal(display.isEnabled(), false);
    assert.ok(display.getReason());
  } finally {
    display.dispose();
  }
});

for (const [label, prototype] of [
  ["tool", ToolExecutionComponent.prototype],
  ["assistant", AssistantMessageComponent.prototype],
] as const) {
  test(`an existing ${label} render patch is respected even when present before display creation`, () => {
    const toolRender = ToolExecutionComponent.prototype.render;
    const assistantRender = AssistantMessageComponent.prototype.render;
    const original = prototype.render;
    const thirdParty = function (this: Renderable, width: number) {
      return original.call(this, width);
    };
    prototype.render = thirdParty;
    const reasons: string[] = [];
    const display = createTerminalChatDisplay({ onFallback: (reason) => reasons.push(reason) });
    try {
      assert.equal(display.enable(), false);
      assert.equal(display.isEnabled(), false);
      assert.ok(display.getReason());
      assert.equal(reasons.length, 1);
      assert.equal(prototype.render, thirdParty);
      display.dispose();
      assert.equal(prototype.render, thirdParty);
      if (label === "tool") assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
      else assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    } finally {
      display.dispose();
      prototype.render = original;
    }
  });

  test(`a later ${label} render patch disables chat display without overwriting the other extension`, () => {
    const reasons: string[] = [];
    const display = createTerminalChatDisplay({ onFallback: (reason) => reasons.push(reason) });
    const toolRender = ToolExecutionComponent.prototype.render;
    const assistantRender = AssistantMessageComponent.prototype.render;
    const original = prototype.render;
    try {
      assert.equal(display.enable(), true);
      const wrapped = prototype.render;
      const thirdParty = function (this: Renderable, width: number) {
        return wrapped.call(this, width);
      };
      prototype.render = thirdParty;
      const component = label === "tool"
        ? new AssistantMessageComponent(assistantMessage("Must remain recoverable"))
        : tool("bash", "conflict");
      component.render(100);
      assert.equal(display.isEnabled(), false);
      assert.ok(display.getReason());
      assert.equal(reasons.length, 1);
      assert.equal(prototype.render, thirdParty);
      const ordinary = tool("read", "after-conflict");
      ordinary.updateResult(textResult("No longer hidden"));
      assert.match(visible(ordinary).join("\n"), /No longer hidden/u);
      display.dispose();
      assert.equal(prototype.render, thirdParty);
      if (label === "tool") assert.equal(AssistantMessageComponent.prototype.render, assistantRender);
      else assert.equal(ToolExecutionComponent.prototype.render, toolRender);
    } finally {
      display.dispose();
      prototype.render = original;
    }
  });
}

test("tool failures restore normal rendering and notify only once", () => {
  const reasons: string[] = [];
  const display = createTerminalChatDisplay({ onFallback: (reason) => reasons.push(reason) });
  const ordinary = tool("read", "earlier-success");
  ordinary.updateResult(textResult("Earlier output"));
  try {
    assert.equal(display.enable(), true);
    assert.deepEqual(visible(ordinary), []);
    const failed = tool("bash", "failed");
    const result = textResult("Permission denied", true);
    const snapshot = structuredClone(result);
    failed.updateResult(result);
    assert.match(visible(failed).join("\n"), /Permission denied/u);
    assert.equal(display.isEnabled(), false);
    assert.ok(display.getReason());
    assert.equal(reasons.length, 1);
    visible(failed);
    assert.equal(reasons.length, 1);
    assert.match(visible(ordinary).join("\n"), /Earlier output/u);
    assert.equal(failed.result, result);
    assert.deepEqual(result, snapshot);
  } finally {
    display.dispose();
  }
});

test("a failing fallback notification cannot break rendering or hide the original failure", () => {
  const display = createTerminalChatDisplay({
    onFallback() {
      throw new Error("Notification UI is unavailable");
    },
  });
  try {
    assert.equal(display.enable(), true);
    const failed = tool("bash", "failed-notification");
    failed.updateResult(textResult("Original tool failure", true));
    assert.doesNotThrow(() => visible(failed));
    assert.match(visible(failed).join("\n"), /Original tool failure/u);
    assert.equal(display.isEnabled(), false);
  } finally {
    display.dispose();
  }
});

test("a failed Human Message delivery is visible and never displayed as successful text", () => {
  const display = createTerminalChatDisplay();
  try {
    assert.equal(display.enable(), true);
    const failed = ownMessage("This was not delivered", "failed-delivery");
    failed.updateResult(textResult("Message delivery failed", true));
    assert.deepEqual(visible(failed), ["Message delivery failed"]);
    assert.equal(display.isEnabled(), false);
  } finally {
    display.dispose();
  }
});

for (const [stopReason, errorMessage, expected] of [
  ["error", "Provider unavailable", /Provider unavailable/u],
  ["aborted", "Request was aborted", /Operation aborted/u],
  ["length", undefined, /Response was truncated before completion/u],
] as const) {
  test(`assistant ${stopReason} stops remain visible and restore normal display`, () => {
    const reasons: string[] = [];
    const display = createTerminalChatDisplay({ onFallback: (reason) => reasons.push(reason) });
    const message = assistantMessage("Partial response", stopReason, errorMessage);
    const snapshot = structuredClone(message);
    try {
      assert.equal(display.enable(), true);
      const component = new AssistantMessageComponent(message);
      assert.match(visible(component).join("\n"), expected);
      assert.equal(display.isEnabled(), false);
      assert.equal(reasons.length, 1);
      assert.equal(component.lastMessage, message);
      assert.deepEqual(message, snapshot);
    } finally {
      display.dispose();
    }
  });
}
