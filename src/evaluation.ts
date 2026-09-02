import type { HumanMessageTraceEvent } from "./recovery.js";

export interface HumanMessageBehaviorScenario {
  id: string;
  category?: string;
  prompt: string;
  minMessages: number;
  maxMessages: number;
  maxCharsPerMessage: number;
  requiredText?: string;
  requiredAnyPhrases?: string[];
  requiredTool?: string;
  maxToolCalls?: number;
  requireMessageBeforeTool?: boolean;
  forbidMessageBeforeTool?: boolean;
  requireMessageAfterTool?: boolean;
  toolOutcome?: "success" | "failure" | "uncertain";
  forbiddenPhrases?: string[];
  allowMarkdown?: boolean;
}

export interface HumanMessageBehaviorResult {
  passed: boolean;
  failures: string[];
  messageCount: number;
  maxObservedChars: number;
}

const RAW_MARKDOWN = /(^|\n)\s*#{1,6}\s|\*\*|__|(^|\n)\s*\|.+\|\s*($|\n)/u;

/** Deterministic transcript gates. Semantic naturalness still requires review. */
export function evaluateHumanMessages(
  scenario: HumanMessageBehaviorScenario,
  messages: string[],
  trace: HumanMessageTraceEvent[] = messages.map((text) => ({ type: "message", text })),
): HumanMessageBehaviorResult {
  const failures: string[] = [];
  if (messages.length < scenario.minMessages || messages.length > scenario.maxMessages) {
    failures.push(
      `expected ${scenario.minMessages}-${scenario.maxMessages} messages, got ${messages.length}`,
    );
  }
  const empty = messages.findIndex((message) => message.trim().length === 0);
  if (empty >= 0) failures.push(`message ${empty + 1} is empty`);
  const maxObservedChars = messages.reduce((max, message) => Math.max(max, message.length), 0);
  if (maxObservedChars > scenario.maxCharsPerMessage) {
    failures.push(
      `longest message has ${maxObservedChars} characters, limit is ${scenario.maxCharsPerMessage}`,
    );
  }
  const normalized = messages.map((message) => message.trim().replace(/\s+/gu, " "));
  if (new Set(normalized).size !== normalized.length) failures.push("duplicate messages detected");
  if (scenario.allowMarkdown !== true && messages.some((message) => RAW_MARKDOWN.test(message))) {
    failures.push("raw report-style Markdown detected in plain-text mode");
  }
  if (
    scenario.requiredText !== undefined
    && !messages.some((message) => message.trim() === scenario.requiredText)
  ) {
    failures.push(`required exact message ${JSON.stringify(scenario.requiredText)} was not delivered`);
  }
  if (
    scenario.requiredAnyPhrases !== undefined
    && !scenario.requiredAnyPhrases.some((phrase) => messages.some((message) => message.includes(phrase)))
  ) {
    failures.push(
      `none of the required phrases were delivered: ${scenario.requiredAnyPhrases.map((phrase) => JSON.stringify(phrase)).join(", ")}`,
    );
  }
  for (const phrase of scenario.forbiddenPhrases ?? []) {
    if (messages.some((message) => message.includes(phrase))) {
      failures.push(`forbidden phrase ${JSON.stringify(phrase)} was delivered`);
    }
  }
  if (scenario.requiredTool !== undefined) {
    const toolCalls = trace.filter(
      (event) => event.type === "tool" && event.name === scenario.requiredTool,
    );
    if (scenario.maxToolCalls !== undefined && toolCalls.length > scenario.maxToolCalls) {
      failures.push(
        `${scenario.requiredTool} was called ${toolCalls.length} times, limit is ${scenario.maxToolCalls}`,
      );
    }
    const toolIndex = trace.findIndex(
      (event) => event.type === "tool" && event.name === scenario.requiredTool,
    );
    if (toolIndex < 0) {
      failures.push(`required tool ${scenario.requiredTool} was not called`);
    } else {
      if (
        scenario.requireMessageBeforeTool === true
        && !trace.slice(0, toolIndex).some((event) => event.type === "message")
      ) {
        failures.push(`no user-visible message was delivered before ${scenario.requiredTool}`);
      }
      if (
        scenario.forbidMessageBeforeTool === true
        && trace.slice(0, toolIndex).some((event) => event.type === "message")
      ) {
        failures.push(`an unnecessary message was delivered before ${scenario.requiredTool}`);
      }
      if (
        scenario.requireMessageAfterTool === true
        && !trace.slice(toolIndex + 1).some((event) => event.type === "message")
      ) {
        failures.push(`no user-visible message was delivered after ${scenario.requiredTool}`);
      }
    }
  }
  return {
    passed: failures.length === 0,
    failures,
    messageCount: messages.length,
    maxObservedChars,
  };
}
