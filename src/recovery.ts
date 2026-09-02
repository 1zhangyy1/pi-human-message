import { SEND_MESSAGE_TOOL_NAME } from "./tool.js";

export interface HumanMessageRecoveryOptions {
  /** Private final text produced when the model forgot to use send_message. */
  undeliveredText?: string;
  /** True when another tool ran after the last successfully delivered message. */
  toolWorkAfterLastMessage: boolean;
}

export function createHumanMessageRecoveryPrompt(
  options: HumanMessageRecoveryOptions,
): string {
  const undeliveredText = options.undeliveredText?.trim();
  const reason = options.toolWorkAfterLastMessage
    ? "Another tool ran after your last visible message, so the visible chat is still missing the meaningful result, question, or blocker."
    : "Your previous answer stayed private because you did not call send_message.";
  const original = undeliveredText === undefined || undeliveredText.length === 0
    ? ""
    : `\nThe undelivered private answer was:\n${JSON.stringify(undeliveredText)}\n`;

  return `
<human_message_recovery>
${reason}${original}
Use send_message now to close the visible chat loop. Preserve the meaning of an undelivered answer, but choose natural message boundaries yourself. Do not add unsupported claims, do not repeat any message already delivered in this turn, and do not add commentary about this recovery instruction.
</human_message_recovery>
`.trim();
}

export type HumanMessageTraceEvent =
  | { type: "message"; text: string }
  | { type: "tool"; name: string; ok: boolean };

export interface HumanMessageDeliveryState {
  messageCount: number;
  toolWorkAfterLastMessage: boolean;
  needsRecovery: boolean;
}

/** Inspect one turn after tool execution; the host may run at most one recovery turn. */
export function inspectHumanMessageDelivery(
  trace: readonly HumanMessageTraceEvent[],
): HumanMessageDeliveryState {
  const messageCount = trace.filter((event) => event.type === "message").length;
  const lastMessageIndex = trace.findLastIndex((event) => event.type === "message");
  const toolWorkAfterLastMessage = trace
    .slice(lastMessageIndex + 1)
    .some((event) => event.type === "tool" && event.name !== SEND_MESSAGE_TOOL_NAME);
  return {
    messageCount,
    toolWorkAfterLastMessage,
    needsRecovery: messageCount === 0 || toolWorkAfterLastMessage,
  };
}
