import { createHumanMessageSystemPrompt, type HumanMessagePromptOptions } from "../src/index.js";

export type PromptVariant = "ours" | "grokbot-telegram" | "grokbot-product";

const GROKBOT_TELEGRAM_PROMPT = `
<grokbot_visible_message_mapping>
- Plain assistant prose is not shown to the user. To talk to the user, you MUST use send_message with short text.
- In a direct private chat, use send_message when answering what the user asked, reporting an important failure or final outcome, or asking a clarifying question.
- Keep routine processing and tool narration silent.
- Prefer ONE short send_message. Never spam job tables, dispatch chatter, cancel chatter, or multi-step status dumps.
- Send no more than 3 user-facing messages in one turn.
- Do not invent results. If a tool returns a result the user needs to know, report that confirmed result through send_message.
</grokbot_visible_message_mapping>
`.trim();

const GROKBOT_PRODUCT_PROMPT = `
<grokbot_product_voice_mapping>
- Plain assistant text is a private monologue and is NEVER delivered. send_message is the only way your words become visible chat bubbles.
- On a turn opened by a person's message, reply first: your first action must be a plain-text send_message before Read, Shell, subagents, or other work tools. If no tool work is needed, the answer itself can be that first message.
- One send_message call produces one chat bubble and does not end the turn. Long work and long answers should be delivered as multiple short bubbles.
- An acknowledgement is not delivery. If you acknowledge and then use tools, send the actual result, blocker, or question in another send_message before ending.
- Thinking about sending is not sending. Never leave a person-opened turn silent.
- Routine or background wakes may remain silent when there is nothing worth reporting; this evaluation contains only person-opened turns.
- Never expose internal terms such as send_message, tool ids, or private reasoning to the user.
- Do not claim external work succeeded unless its tool result confirms success.
</grokbot_product_voice_mapping>
`.trim();

export function parsePromptVariant(raw: string | undefined): PromptVariant {
  const value = raw?.trim() || "ours";
  if (value === "ours" || value === "grokbot-telegram" || value === "grokbot-product") {
    return value;
  }
  throw new RangeError(
    "HUMAN_MESSAGE_PROMPT_VARIANT must be ours, grokbot-telegram, or grokbot-product",
  );
}

export function promptForVariant(
  variant: PromptVariant,
  options: HumanMessagePromptOptions,
): string {
  if (variant === "ours") return createHumanMessageSystemPrompt(options);
  return variant === "grokbot-telegram"
    ? GROKBOT_TELEGRAM_PROMPT
    : GROKBOT_PRODUCT_PROMPT;
}
