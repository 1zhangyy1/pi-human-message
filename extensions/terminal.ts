import type { HumanMessageToolPresentation } from "../src/pi-extension.js";
import type { SendMessagePort } from "../src/tool.js";
import { Container, Text } from "@earendil-works/pi-tui";

/** History is rendered with today's tool definition, not its original owner. */
export function isTerminalDeliveryReceipt(details: unknown, toolCallId: unknown): boolean {
  if (typeof details !== "object" || details === null
    || typeof toolCallId !== "string" || !toolCallId) return false;
  const receipt = details as Record<string, unknown>;
  return receipt.messageId === `pi-terminal:${toolCallId}`
    && Array.isArray(receipt.externalMessageIds)
    && receipt.externalMessageIds.length === 0
    && typeof receipt.idempotentReplay === "boolean";
}

/** Local delivery completes only when Pi has a result it can persist and render. */
export function createTerminalSendMessagePort(
  canDeliver: () => boolean = () => true,
): SendMessagePort {
  const delivered = new Set<string>();
  return async ({ toolCallId }) => {
    if (!canDeliver()) {
      throw new Error("Terminal delivery is only available in interactive Pi mode.");
    }
    const idempotentReplay = delivered.has(toolCallId);
    delivered.add(toolCallId);
    return {
      messageId: `pi-terminal:${toolCallId}`,
      externalMessageIds: [],
      idempotentReplay,
    };
  };
}

/** Render confirmed terminal deliveries as quiet standalone messages. */
export function createTerminalToolPresentation(): HumanMessageToolPresentation {
  return {
    renderShell: "self",
    renderCall: () => new Container(),
    renderResult(result, options, theme, context) {
      if (options.isPartial) return new Container();
      const resultText = result.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      if (context.isError) {
        return new Text(
          theme.fg("error", resultText || "Message was not delivered."),
          0,
          0,
        );
      }
      const text = typeof context.args?.text === "string" ? context.args.text.trim() : "";
      if (!isTerminalDeliveryReceipt(result.details, context.toolCallId) || !text) {
        // A same-name historical tool may have returned a draft or a confirmation
        // request. Its arguments are not evidence that any message was sent.
        return new Text([
          theme.fg("muted", "send_message · unverified result"),
          theme.fg("toolOutput", resultText || "No confirmed terminal message is available."),
        ].join("\n"), 0, 0);
      }
      return new Text(
        theme.fg("text", text),
        0,
        0,
      );
    },
  };
}
