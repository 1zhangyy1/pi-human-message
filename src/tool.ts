import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "@earendil-works/pi-ai";

export const SEND_MESSAGE_TOOL_NAME = "send_message";
export const DEFAULT_MAX_MESSAGE_CHARS = undefined;

export function createSendMessageParameters(maxMessageChars?: number) {
  if (maxMessageChars !== undefined
    && (!Number.isSafeInteger(maxMessageChars) || maxMessageChars < 1)) {
    throw new RangeError("maxMessageChars must be a positive safe integer");
  }
  return Type.Object(
    {
      text: Type.String({
        minLength: 1,
        ...(maxMessageChars === undefined ? {} : { maxLength: maxMessageChars }),
        description: "The complete text for one natural user-visible chat bubble.",
      }),
    },
    { additionalProperties: false },
  );
}

export const SEND_MESSAGE_PARAMETERS = createSendMessageParameters();
type SendMessageInput = Static<typeof SEND_MESSAGE_PARAMETERS>;

export interface SendMessageRequest {
  toolCallId: string;
  text: string;
}

export interface SendMessageReceipt {
  /** Stable host-side id used for replay and transcript identity. */
  messageId: string;
  /** Zero or more platform ids produced by chunking or fan-out. */
  externalMessageIds: string[];
  /** True when the host returned a previously committed delivery. */
  idempotentReplay: boolean;
}

export type SendMessagePort = (
  request: SendMessageRequest,
  signal?: AbortSignal,
) => Promise<SendMessageReceipt>;

export interface SendMessageToolOptions {
  /** Optional host limit; omitted by default. Platform limits stay host-owned. */
  maxMessageChars?: number;
}

export interface TurnBoundSendMessageOptions {
  /** Optional host-imposed delivery cap. Omit to allow agent-chosen counts. */
  maxMessagesPerTurn?: number;
  /** Already committed messages when a durable host resumes the same turn. */
  initialSentCount?: number;
}

export interface TurnBoundSendMessagePort {
  readonly send: SendMessagePort;
  readonly sentCount: number;
  /** Begin a new host-defined turn. */
  reset(): void;
}

/**
 * Track delivery across a turn, with a cap only when the host explicitly opts in.
 *
 * Prompt guidance is behavioral; channel limits remain host-owned. A Pi
 * extension resets it on `before_agent_start`. Agent-core hosts may create one
 * controller per user turn or call `reset()` themselves.
 */
export function createTurnBoundSendMessagePort(
  deliver: SendMessagePort,
  options: TurnBoundSendMessageOptions = {},
): TurnBoundSendMessagePort {
  const { maxMessagesPerTurn } = options;
  if (maxMessagesPerTurn !== undefined
    && (!Number.isSafeInteger(maxMessagesPerTurn) || maxMessagesPerTurn < 1)) {
    throw new RangeError("maxMessagesPerTurn must be a positive safe integer");
  }
  const initialSentCount = options.initialSentCount ?? 0;
  if (
    !Number.isSafeInteger(initialSentCount)
    || initialSentCount < 0
    || (maxMessagesPerTurn !== undefined && initialSentCount > maxMessagesPerTurn)
  ) {
    throw new RangeError("initialSentCount must be a non-negative safe integer within any explicit maxMessagesPerTurn");
  }
  let sentCount = initialSentCount;
  return {
    get sentCount() {
      return sentCount;
    },
    async send(request, signal) {
      if (maxMessagesPerTurn !== undefined && sentCount >= maxMessagesPerTurn) {
        throw new RangeError(
          `send_message turn limit reached (${maxMessagesPerTurn}); do not send another bubble`,
        );
      }
      const receipt = await deliver(request, signal);
      if (!receipt.idempotentReplay) sentCount += 1;
      return receipt;
    },
    reset() {
      sentCount = 0;
    },
  };
}

export function createSendMessageAgentTool(
  send: SendMessagePort,
  options: SendMessageToolOptions = {},
): AgentTool<typeof SEND_MESSAGE_PARAMETERS, SendMessageReceipt> {
  const maxMessageChars = options.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS;
  const parameters = createSendMessageParameters(maxMessageChars);
  return {
    name: SEND_MESSAGE_TOOL_NAME,
    label: "Send Message",
    description: [
      "Deliver one complete user-visible message to the current conversation now.",
      "Each call creates a separate chat bubble and returns its delivery receipt.",
      "Choose message boundaries by meaning and natural pauses; call again when a separate thought or later verified result deserves another bubble.",
      "A line break inside one call is still one bubble. Closely related sentences can stay together.",
      "The text must stand on its own as a complete thought; never send an incomplete word or sentence fragment merely to reach a requested message count.",
      "Plain assistant text is private, and the host already binds the destination, so do not provide a channel or recipient.",
    ].join(" "),
    parameters,
    executionMode: "sequential",
    async execute(toolCallId, input: SendMessageInput, signal) {
      const text = input.text.trim();
      if (text.length === 0) throw new TypeError("send_message.text must not be empty");
      if (maxMessageChars !== undefined && text.length > maxMessageChars) {
        throw new RangeError(`send_message.text must not exceed ${maxMessageChars} characters`);
      }
      const receipt = await send({ toolCallId, text }, signal);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "delivered",
            idempotent_replay: receipt.idempotentReplay,
          }),
        }],
        details: receipt,
      };
    },
  };
}
