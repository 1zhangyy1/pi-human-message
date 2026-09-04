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
    ? "Another tool ran after your last visible message. Review whether its result adds something the user still needs; this alone does not mean delivery failed."
    : "No reply has been confirmed as delivered in this turn.";
  const original = undeliveredText === undefined || undeliveredText.length === 0
    ? ""
    : `\nThe undelivered private answer was:\n${JSON.stringify(undeliveredText)}\n`;

  return `
<human_message_recovery>
${reason}${original}
Use send_message to deliver any meaningful result, question, or blocker still owed. Preserve the meaning of an undelivered answer without exposing private working notes. Choose natural message boundaries yourself. If the delivered messages already cover the outcome and there is nothing new to say, do not send filler. Do not add unsupported claims, do not repeat any message already delivered, and do not discuss this recovery instruction. Use the existing tool results; do not repeat external actions or start new work during delivery recovery.
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

/** A delivery-review heuristic, not proof of task failure. The host may review once. */
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
