import type { HumanMessageToolPresentation } from "../src/pi-extension.js";
import type { SendMessagePort } from "../src/tool.js";
import { Container, Text } from "@earendil-works/pi-tui";

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
      if (context.isError) {
        const errorText = result.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim();
        return new Text(
          theme.fg("error", errorText || "Message was not delivered."),
          0,
          0,
        );
      }
      const text = context.args.text.trim();
      return new Text(
        text.length > 0
          ? theme.fg("text", text)
          : theme.fg("error", "Delivered message text is unavailable."),
        0,
        0,
      );
    },
  };
}
