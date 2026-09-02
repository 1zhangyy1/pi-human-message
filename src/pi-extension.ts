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
        "Use multiple send_message calls only for genuinely distinct conversational beats, never to split text mechanically.",
      ],
    });
    const prompt = createHumanMessageSystemPrompt(options);
    pi.on("before_agent_start", async (event) => {
      delivery.reset();
      return { systemPrompt: `${event.systemPrompt}\n\n${prompt}` };
    });
  };
}
