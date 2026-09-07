import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PI_TERMINAL_TOOL_GUIDELINE } from "../src/pi-extension.js";
import { createTerminalChatDisplay } from "./chat-display.js";

type Mode = "chat" | "normal";
const VIEW_ENTRY = "human-message-view";

/** Session-scoped display policy. No model calls, message rewriting, or tool replacement. */
export function registerTerminalChatMode(
  pi: ExtensionAPI,
  getDeliveryStatus: (mode: ExtensionContext["mode"]) => string,
): void {
  let current: ExtensionContext | undefined;
  let generation = 0;
  let wanted: Mode = "chat";
  let unvoicedText = false;

  function canDeliver(): boolean {
    return pi.getActiveTools().includes("send_message")
      && (pi.getAllTools().find((tool) => tool.name === "send_message")
        ?.promptGuidelines?.includes(PI_TERMINAL_TOOL_GUIDELINE) ?? false);
  }

  const display = createTerminalChatDisplay({
    canHideTool: (name) => pi.getAllTools().find((tool) => tool.name === name)
      ?.sourceInfo.source === "builtin",
    onFallback(reason) {
      wanted = "normal";
      const ctx = current;
      const epoch = generation;
      // render() may be in progress. Do not mutate Pi's component tree inside it.
      queueMicrotask(() => {
        if (!ctx || current !== ctx || epoch !== generation || ctx.mode !== "tui") return;
        pi.appendEntry(VIEW_ENTRY, { mode: "normal" });
        ctx.ui.setStatus("human-message", "messages · normal view");
        ctx.ui.notify(`Human Message: ${reason}`, "warning");
      });
    },
  });

  function historyBlocker(ctx: ExtensionContext): string | undefined {
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      const message = entry.message;
      if ((message.role === "toolResult" && message.isError)
        || (message.role === "assistant" && ["error", "aborted", "length"].includes(message.stopReason))) {
        return "This session contains an error or interrupted response. Keeping the full transcript visible; use /new for chat view.";
      }
      if (message.role === "assistant"
        && message.content.some((block) => block.type === "text" && block.text.trim())) {
        return "This session contains ordinary assistant replies. Keeping them visible; use /new for chat view.";
      }
    }
    return undefined;
  }

  function updateStatus(ctx: ExtensionContext): void {
    if (ctx.mode === "tui") {
      ctx.ui.setStatus("human-message", display.isEnabled() ? "messages · chat view" : "messages · normal view");
    }
  }

  function useNormal(ctx: ExtensionContext, reason?: string): void {
    wanted = "normal";
    display.disable();
    pi.appendEntry(VIEW_ENTRY, { mode: wanted });
    updateStatus(ctx);
    if (reason && ctx.hasUI) ctx.ui.notify(`Human Message: ${reason}`, "warning");
  }

  function enable(ctx: ExtensionContext): boolean {
    if (ctx.mode !== "tui" || !canDeliver()) {
      display.disable();
      return false;
    }
    const blocker = historyBlocker(ctx);
    if (blocker) {
      useNormal(ctx, blocker);
      return false;
    }
    return display.enable();
  }

  function restore(_event: unknown, ctx: ExtensionContext): void {
    generation++;
    display.disable();
    current = ctx;
    unvoicedText = false;
    wanted = "chat";
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "custom" || entry.customType !== VIEW_ENTRY) continue;
      const mode = (entry.data as { mode?: unknown } | undefined)?.mode;
      if (mode === "chat" || mode === "normal") wanted = mode;
    }
    if (ctx.mode === "tui" && wanted === "chat") enable(ctx);
    updateStatus(ctx);
  }

  function change(mode: Mode, ctx: ExtensionContext): void {
    if (ctx.mode !== "tui") {
      ctx.ui.notify("Human Message chat view is available only in the interactive Pi terminal.", "info");
      return;
    }
    current = ctx;
    generation++;
    if (mode === "normal") {
      useNormal(ctx);
    } else {
      wanted = "chat";
      if (enable(ctx)) pi.appendEntry(VIEW_ENTRY, { mode: "chat" });
      updateStatus(ctx);
    }
    ctx.ui.notify(`Human Message is ${getDeliveryStatus(ctx.mode)}. View: ${display.isEnabled() ? "chat" : "normal"}.`, "info");
  }

  pi.registerCommand("human-message", {
    description: "Show delivery status or switch chat / normal display",
    handler: async (args, ctx) => {
      const action = args.trim() || "status";
      if (action === "chat" || action === "normal") change(action, ctx);
      else if (action === "status") {
        ctx.ui.notify(`Human Message is ${getDeliveryStatus(ctx.mode)}. View: ${display.isEnabled() ? "chat" : "normal"}.`, "info");
      } else ctx.ui.notify("Usage: /human-message [chat|normal|status]. F8 switches views.", "info");
    },
  });
  pi.registerShortcut("f8", {
    description: "Switch Human Message chat / normal display",
    handler: (ctx) => change(display.isEnabled() ? "normal" : "chat", ctx),
  });
  pi.on("session_start", restore);
  pi.on("session_tree", restore);
  pi.on("before_agent_start", (_event, ctx) => {
    current = ctx;
    unvoicedText = false;
    if (!canDeliver() || ctx.mode !== "tui") display.disable();
    else if (wanted === "chat" && !display.isEnabled()) enable(ctx);
    updateStatus(ctx);
  });
  pi.on("message_end", (event) => {
    if (event.message.role === "assistant"
      && event.message.content.some((block) => block.type === "text" && block.text.trim())) {
      unvoicedText = true;
    }
  });
  pi.on("agent_settled", (_event, ctx) => {
    if (display.isEnabled() && unvoicedText) {
      useNormal(ctx, "The agent wrote outside send_message. Showing the original response so nothing is lost.");
    }
  });
  pi.on("session_shutdown", () => {
    generation++;
    current = undefined;
    display.dispose();
  });
}
