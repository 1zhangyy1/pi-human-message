import type {
  ExtensionFactory,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";

import {
  createHumanMessageSystemPrompt,
  createHumanMessageTurnReminder,
  type HumanMessagePromptOptions,
} from "./prompt.js";
import {
  createSendMessageAgentTool,
  SEND_MESSAGE_PARAMETERS,
  SEND_MESSAGE_TOOL_NAME,
  createTurnBoundSendMessagePort,
  type SendMessagePort,
  type SendMessageReceipt,
  type SendMessageToolOptions,
} from "./tool.js";

export type HumanMessageToolPresentation = Pick<
  ToolDefinition<typeof SEND_MESSAGE_PARAMETERS, SendMessageReceipt>,
  "renderCall" | "renderResult" | "renderShell"
>;

export const PI_TERMINAL_TOOL_GUIDELINE =
  "Use send_message for separate conversational terminal messages; ordinary assistant text is also visible, so never duplicate a delivered reply.";
export const BOUND_CHAT_TOOL_GUIDELINE =
  "Use send_message for every user-visible reply; plain assistant text is private.";

export interface HumanMessageExtensionOptions
  extends HumanMessagePromptOptions, SendMessageToolOptions {
  send: SendMessagePort;
  /** Optional host presentation; delivery behavior remains owned by send. */
  toolPresentation?: HumanMessageToolPresentation;
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
    const deliverySurface = options.deliverySurface ?? "bound_chat";
    const ownershipGuideline = deliverySurface === "pi_terminal"
      ? PI_TERMINAL_TOOL_GUIDELINE
      : BOUND_CHAT_TOOL_GUIDELINE;
    pi.registerTool({
      ...createSendMessageAgentTool(delivery.send, options, deliverySurface),
      promptSnippet: "Deliver one user-visible chat bubble to the current conversation",
      promptGuidelines: [
        ownershipGuideline,
        "Choose message boundaries by meaning and natural pauses, without a fixed message count or reply template.",
        "Never split text mechanically or create filler just to increase the message count.",
      ],
      ...(options.toolPresentation ?? {}),
    });
    const prompt = createHumanMessageSystemPrompt(options);
    const reminder = createHumanMessageTurnReminder(options);
    pi.on("before_agent_start", async (event, ctx) => {
      if (!pi.getActiveTools().includes(SEND_MESSAGE_TOOL_NAME)) return;
      const registeredTool = pi.getAllTools().find(
        (tool) => tool.name === SEND_MESSAGE_TOOL_NAME,
      );
      const ownsTool = registeredTool?.promptGuidelines?.includes(
        ownershipGuideline,
      ) ?? false;
      if (!ownsTool || (deliverySurface === "pi_terminal" && ctx.mode !== "tui")) return;
      delivery.reset();
      return {
        systemPrompt: `${event.systemPrompt}\n\n${prompt}`,
        message: {
          customType: "human-message-turn-reminder",
          content: reminder,
          display: false,
        },
      };
    });
  };
}
