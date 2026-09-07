import { createHash } from "node:crypto";
import {
  AssistantMessageComponent,
  ToolExecutionComponent,
  VERSION,
} from "@earendil-works/pi-coding-agent";

import { PI_TERMINAL_TOOL_GUIDELINE } from "../src/pi-extension.js";

// Pi has no global transcript filter API. Keep this compatibility boundary
// separate from the message tool, and reject unverified or patched renderers.
const VERIFIED_RENDERERS: Record<string, { tool: string; assistant: string }[]> = {
  "0.85.1": [{
    // Published ESM modules (SDK/tests).
    tool: "8f415eac22749a2d13fff5a14223fb98790006d6dd52c0a18769ddaa00d96b3b",
    assistant: "b32d71cf32320dd71d4c6edc6a606da7340b6635bf05e2368ba5ef43bbdc6e50",
  }, {
    // Published CLI bundle. Its minified methods have the same behavior.
    tool: "7ad4ecd93bf47d5d3b1fd169b40b7b161af8d73ffe11fdd833e2748d55373f6e",
    assistant: "706329ba0e6e22acb726e6d444f23754f16fcce5cc021b7574a44b2480e2ec71",
  }],
};

interface ToolState {
  toolName: string;
  isPartial: boolean;
  result?: { isError: boolean };
  toolDefinition?: {
    promptGuidelines?: string[];
    renderCall?: unknown;
    renderResult?: unknown;
  };
}

interface AssistantState {
  lastMessage?: {
    role: string;
    content: unknown[];
    stopReason: string;
  };
}

export interface TerminalChatDisplayOptions {
  onFallback?: (reason: string) => void;
  version?: string;
  /** Only known built-ins may have their custom renderers hidden. */
  canHideTool?: (name: string) => boolean;
}

export function createTerminalChatDisplay(options: TerminalChatDisplayOptions = {}) {
  const toolPrototype = ToolExecutionComponent.prototype;
  const assistantPrototype = AssistantMessageComponent.prototype;
  let originalTool: typeof toolPrototype.render | undefined;
  let originalAssistant: typeof assistantPrototype.render | undefined;
  let enabled = false;
  let reason: string | undefined;

  function disable(): void {
    enabled = false;
    // Another extension may wrap our functions. Never overwrite its changes;
    // a wrapper it retained will now delegate to the original renderer.
    if (originalTool && toolPrototype.render === renderTool) {
      toolPrototype.render = originalTool;
    }
    if (originalAssistant && assistantPrototype.render === renderAssistant) {
      assistantPrototype.render = originalAssistant;
    }
  }

  function fallback(message: string): false {
    const changed = enabled || reason !== message;
    reason = message;
    disable();
    if (changed) {
      try { options.onFallback?.(message); } catch { /* A failed notification must not hide the transcript. */ }
    }
    return false;
  }

  function isEnabled(): boolean {
    if (!enabled) return false;
    if (toolPrototype.render !== renderTool || assistantPrototype.render !== renderAssistant) {
      return fallback("Another extension changed Pi's display. Showing the normal transcript.");
    }
    return true;
  }

  function renderTool(this: ToolExecutionComponent, width: number): string[] {
    if (isEnabled()) {
      try {
        const state = this as unknown as ToolState;
        if (typeof state.toolName !== "string" || typeof state.isPartial !== "boolean"
          || !Object.hasOwn(this, "result") || !Object.hasOwn(this, "toolDefinition")
          || (state.result !== undefined && (state.result === null
            || typeof state.result.isError !== "boolean"))
          || (state.toolDefinition !== undefined
            && (state.toolDefinition === null || typeof state.toolDefinition !== "object"))) {
          fallback("Pi's tool display changed. Showing the normal transcript.");
        } else if (state.result?.isError) {
          fallback("A tool failed. Showing the normal transcript so you can inspect the error.");
        } else if (state.toolName === "send_message"
          && Array.isArray(state.toolDefinition?.promptGuidelines)
          && state.toolDefinition.promptGuidelines.includes(PI_TERMINAL_TOOL_GUIDELINE)) {
          // A successful Human Message is visible as soon as its tool settles,
          // including messages reconstructed when resuming a session.
        } else {
          const customRenderer = typeof state.toolDefinition?.renderCall === "function"
            || typeof state.toolDefinition?.renderResult === "function";
          // A completed result may still contain buttons or other controls.
          if (customRenderer && !options.canHideTool?.(state.toolName)) {
            fallback("A tool has its own interactive display. Showing the normal transcript.");
          } else {
            return [];
          }
        }
      } catch {
        fallback("Chat display could not inspect a tool safely. Showing the normal transcript.");
      }
    }
    return originalTool?.call(this, width) ?? [];
  }

  function renderAssistant(this: AssistantMessageComponent, width: number): string[] {
    if (isEnabled()) {
      try {
        const state = this as unknown as AssistantState;
        if (!Object.hasOwn(this, "lastMessage")
          || (state.lastMessage !== undefined && (state.lastMessage?.role !== "assistant"
            || !Array.isArray(state.lastMessage.content)
            || typeof state.lastMessage.stopReason !== "string"))) {
          fallback("Pi's assistant display changed. Showing the normal transcript.");
        } else if (["error", "aborted", "length"].includes(state.lastMessage?.stopReason ?? "")) {
          fallback("The response did not finish normally. Showing the normal transcript.");
        } else {
          return [];
        }
      } catch {
        fallback("Chat display could not inspect a response safely. Showing the normal transcript.");
      }
    }
    return originalAssistant?.call(this, width) ?? [];
  }

  function enable(): boolean {
    if (enabled) return isEnabled();
    const version = options.version ?? VERSION;
    const verified = VERIFIED_RENDERERS[version];
    if (!verified) {
      return fallback(`Chat display is not verified for Pi ${version}. Normal Pi display remains available.`);
    }
    const fingerprint = (fn: Function) => createHash("sha256")
      .update(Function.prototype.toString.call(fn)).digest("hex");
    const toolHash = fingerprint(toolPrototype.render);
    const assistantHash = fingerprint(assistantPrototype.render);
    if (!verified.some((pair) => toolHash === pair.tool && assistantHash === pair.assistant)) {
      return fallback("Pi's display is customized or has changed. Normal Pi display remains available.");
    }
    originalTool = toolPrototype.render;
    originalAssistant = assistantPrototype.render;
    toolPrototype.render = renderTool;
    assistantPrototype.render = renderAssistant;
    reason = undefined;
    enabled = true;
    return true;
  }

  return { enable, disable, dispose: disable, isEnabled, getReason: () => reason };
}
