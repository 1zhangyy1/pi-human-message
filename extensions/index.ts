import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";

import {
  BOUND_CHAT_TOOL_GUIDELINE,
  createHumanMessageExtension,
  createWebhookSendMessagePort,
  PI_TERMINAL_TOOL_GUIDELINE,
} from "../src/index.js";
import {
  createTerminalSendMessagePort,
  createTerminalToolPresentation,
} from "./terminal.js";

export const WEBHOOK_URL_ENV = "PI_HUMAN_MESSAGE_WEBHOOK_URL";
export const WEBHOOK_TOKEN_ENV = "PI_HUMAN_MESSAGE_WEBHOOK_TOKEN";

/** Build the extension that `pi install` discovers from the package manifest. */
export function createInstalledHumanMessageExtension(
  environment: NodeJS.ProcessEnv = process.env,
): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    const rawUrl = environment[WEBHOOK_URL_ENV]?.trim();

    if (rawUrl === undefined || rawUrl.length === 0) {
      let sessionMode: PiMode | undefined;
      createHumanMessageExtension({
        send: createTerminalSendMessagePort(
          () => sessionMode === "tui"
            && ownsSendMessage(pi, PI_TERMINAL_TOOL_GUIDELINE)
            && pi.getActiveTools().includes("send_message"),
        ),
        deliverySurface: "pi_terminal",
        format: "plain_text",
        toolPresentation: createTerminalToolPresentation(),
      })(pi);
      registerStatus(pi, (ctx) => terminalStatus(pi, ctx.mode));
      pi.on("session_start", async (_event, ctx) => {
        sessionMode = ctx.mode;
        const ownsTool = ownsSendMessage(pi, PI_TERMINAL_TOOL_GUIDELINE);
        if (!ownsTool) {
          if (ctx.hasUI) {
            ctx.ui.notify(
              "Human Message is inactive: another extension owns send_message.",
              "warning",
            );
          }
          return;
        }
        if (ctx.mode !== "tui") {
          pi.setActiveTools(pi.getActiveTools().filter((name) => name !== "send_message"));
        }
      });
      return;
    }

    let endpoint: URL;
    try {
      endpoint = new URL(rawUrl);
      const send = createWebhookSendMessagePort({
        url: rawUrl,
        ...(environment[WEBHOOK_TOKEN_ENV] === undefined
          ? {}
          : { bearerToken: environment[WEBHOOK_TOKEN_ENV] }),
      });
      createHumanMessageExtension({ send })(pi);
      const endpointOrigin = endpoint.origin;
      registerStatus(pi, () => boundChatStatus(pi, endpointOrigin));
      pi.on("session_start", async (_event, ctx) => {
        if (ctx.hasUI && !ownsSendMessage(pi, BOUND_CHAT_TOOL_GUIDELINE)) {
          ctx.ui.notify(
            "Human Message is inactive: another extension owns send_message.",
            "warning",
          );
        }
      });
    } catch (error) {
      const status = `inactive: ${error instanceof Error ? error.message : String(error)}`;
      pi.on("session_start", async (_event, ctx) => {
        if (ctx.hasUI) ctx.ui.notify(`Human Message is ${status}.`, "error");
      });
      registerStatus(pi, () => status);
    }
  };
}

type PiMode = "tui" | "rpc" | "json" | "print";

function ownsSendMessage(pi: ExtensionAPI, guideline: string): boolean {
  const tool = pi.getAllTools().find((candidate) => candidate.name === "send_message");
  return tool?.promptGuidelines?.includes(guideline) ?? false;
}

function terminalStatus(pi: ExtensionAPI, mode: PiMode): string {
  if (!ownsSendMessage(pi, PI_TERMINAL_TOOL_GUIDELINE)) {
    return "inactive: another extension owns send_message";
  }
  if (mode !== "tui") {
    return `inactive: terminal delivery is unavailable in ${mode} mode`;
  }
  return pi.getActiveTools().includes("send_message")
    ? "active: delivering in this Pi terminal"
    : "inactive: send_message is disabled in this Pi session";
}

function boundChatStatus(pi: ExtensionAPI, endpointOrigin: string): string {
  if (!ownsSendMessage(pi, BOUND_CHAT_TOOL_GUIDELINE)) {
    return "inactive: another extension owns send_message";
  }
  return pi.getActiveTools().includes("send_message")
    ? `active: delivering to ${endpointOrigin}`
    : "inactive: send_message is disabled in this Pi session";
}

function registerStatus(
  pi: ExtensionAPI,
  getStatus: (context: { mode: PiMode }) => string,
): void {
  pi.registerCommand("human-message", {
    description: "Show Human Message delivery status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(`Human Message is ${getStatus(ctx)}.`, "info");
    },
  });
}

export default createInstalledHumanMessageExtension();
