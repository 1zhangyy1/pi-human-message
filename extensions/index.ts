import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";

import {
  createHumanMessageExtension,
  createWebhookSendMessagePort,
} from "../src/index.js";

export const WEBHOOK_URL_ENV = "PI_HUMAN_MESSAGE_WEBHOOK_URL";
export const WEBHOOK_TOKEN_ENV = "PI_HUMAN_MESSAGE_WEBHOOK_TOKEN";

/** Build the extension that `pi install` discovers from the package manifest. */
export function createInstalledHumanMessageExtension(
  environment: NodeJS.ProcessEnv = process.env,
): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    const rawUrl = environment[WEBHOOK_URL_ENV]?.trim();
    let status: string;

    if (rawUrl === undefined || rawUrl.length === 0) {
      status = `inactive: set ${WEBHOOK_URL_ENV} to a route-bound delivery endpoint`;
      registerStatus(pi, () => status);
      pi.on("session_start", async (_event, ctx) => {
        if (ctx.hasUI) ctx.ui.notify(`Human Message is ${status}.`, "warning");
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
      status = `active: delivering to ${endpoint.origin}`;
    } catch (error) {
      status = `inactive: ${error instanceof Error ? error.message : String(error)}`;
      pi.on("session_start", async (_event, ctx) => {
        if (ctx.hasUI) ctx.ui.notify(`Human Message is ${status}.`, "error");
      });
    }
    registerStatus(pi, () => status);
  };
}

function registerStatus(pi: ExtensionAPI, getStatus: () => string): void {
  pi.registerCommand("human-message", {
    description: "Show Human Message delivery status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(`Human Message is ${getStatus()}.`, "info");
    },
  });
}

export default createInstalledHumanMessageExtension();
