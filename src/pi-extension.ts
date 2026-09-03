import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

import {
  createHumanMessageSystemPrompt,
  type HumanMessagePromptOptions,
} from "./prompt.js";
import {
  createSendMessageAgentTool,
  createTurnBoundSendMessagePort,
  type SendMessagePort,
  type SendMessageToolOptions,
} from "./tool.js";

export interface HumanMessageExtensionOptions
  extends HumanMessagePromptOptions, SendMessageToolOptions {
  send: SendMessagePort;
}

/** Create a Pi extension for a host that already owns the current destination. */
export function createHumanMessageExtension(
  options: HumanMessageExtensionOptions,
): ExtensionFactory {
  return (pi) => {
    const delivery = createTurnBoundSendMessagePort(options.send, {
      ...(options.maxMessagesPerTurn === undefined
        ? {}
        : { maxMessagesPerTurn: options.maxMessagesPerTurn }),
    });
    pi.registerTool({
      ...createSendMessageAgentTool(delivery.send, options),
      promptSnippet: "Deliver one user-visible chat bubble to the current conversation",
      promptGuidelines: [
        "Use send_message for every user-visible reply; plain assistant text is private.",
        "Keep one conversational act in one bubble; when the purpose changes and a natural pause belongs between acts, use another send_message call.",
        "Never split text mechanically or create filler just to increase the message count.",
      ],
    });
    const prompt = createHumanMessageSystemPrompt(options);
    pi.on("before_agent_start", async (event) => {
      delivery.reset();
      return { systemPrompt: `${event.systemPrompt}\n\n${prompt}` };
    });
  };
}
