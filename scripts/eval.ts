import { readFile } from "node:fs/promises";

import { Agent, type AgentMessage, type AgentTool } from "@earendil-works/pi-agent-core";
import {
  createModels,
  InMemoryCredentialStore,
  type Api,
  type Model,
  type Models,
} from "@earendil-works/pi-ai";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { Type } from "@earendil-works/pi-ai";

import {
  createHumanMessageRecoveryPrompt,
  createSendMessageAgentTool,
  createTurnBoundSendMessagePort,
  inspectHumanMessageDelivery,
  withHumanMessageTurnReminder,
  type HumanMessageAcknowledgement,
  type HumanMessageTraceEvent,
} from "../src/index.js";
import {
  evaluateHumanMessages,
  type HumanMessageBehaviorScenario,
} from "../src/evaluation.js";
import { parsePromptVariant, promptForVariant } from "./prompt-variants.js";

const provider = process.env.PI_PROVIDER?.trim() || "openrouter";
const modelId = process.env.PI_MODEL?.trim() || "openai/gpt-5.6-luna";
const apiKey = resolveApiKey(provider);
const promptVariant = parsePromptVariant(process.env.HUMAN_MESSAGE_PROMPT_VARIANT);
const acknowledgement = parseAcknowledgement(process.env.HUMAN_MESSAGE_ACKNOWLEDGEMENT);
const repeats = parsePositiveInteger(process.env.EVAL_REPEATS, 1, "EVAL_REPEATS", 10);
const limit = parsePositiveInteger(process.env.EVAL_LIMIT, Number.MAX_SAFE_INTEGER, "EVAL_LIMIT");
const allScenarios = JSON.parse(
  await readFile(new URL("../evals/scenarios.json", import.meta.url), "utf8"),
) as HumanMessageBehaviorScenario[];
const scenarios = selectScenarios(allScenarios, process.env.EVAL_IDS).slice(0, limit);
const runtime = await createRuntime(provider, modelId, apiKey);
const results: EvalResult[] = [];

for (let repeat = 1; repeat <= repeats; repeat += 1) {
  for (const scenario of scenarios) {
    results.push(await runScenario({
      scenario,
      repeat,
      runtime,
      apiKey,
      promptVariant,
      acknowledgement,
    }));
  }
}

const passed = results.filter((result) => result.passed).length;
const recovered = results.filter((result) => result.recovered).length;
const totalMessages = results.reduce((sum, result) => sum + result.messages.length, 0);
const output = {
  generatedAt: new Date().toISOString(),
  provider,
  modelId,
  promptVariant,
  acknowledgement,
  repeats,
  scenarioCount: scenarios.length,
  runs: results.length,
  passed,
  failed: results.length - passed,
  recovered,
  metrics: {
    passRate: ratio(passed, results.length),
    directDeliveryRate: ratio(results.length - recovered, results.length),
    averageMessagesPerTurn: ratio(totalMessages, results.length),
    multiMessageTurns: results.filter((result) => result.messages.length > 1).length,
    longestMessageChars: results.reduce(
      (max, result) => Math.max(max, ...result.messages.map((message) => message.length)),
      0,
    ),
  },
  categories: categorySummary(results),
  results,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (passed !== results.length && process.env.EVAL_ALLOW_FAILURES !== "1") {
  process.exitCode = 1;
}

interface Runtime {
  model: Model<Api>;
  models: Models;
}

interface EvalResult {
  id: string;
  category: string;
  repeat: number;
  passed: boolean;
  recovered: boolean;
  messages: string[];
  trace: HumanMessageTraceEvent[];
  failures: string[];
  error?: string;
}

async function runScenario(options: {
  scenario: HumanMessageBehaviorScenario;
  repeat: number;
  runtime: Runtime;
  apiKey: string;
  promptVariant: ReturnType<typeof parsePromptVariant>;
  acknowledgement: HumanMessageAcknowledgement;
}): Promise<EvalResult> {
  const { scenario, repeat, runtime, apiKey, promptVariant, acknowledgement } = options;
  const messages: string[] = [];
  const trace: HumanMessageTraceEvent[] = [];
  const delivery = createTurnBoundSendMessagePort(async ({ toolCallId, text }) => {
    messages.push(text);
    trace.push({ type: "message", text });
    return {
      messageId: `eval:${repeat}:${scenario.id}:${toolCallId}`,
      externalMessageIds: [`memory:${messages.length}`],
      idempotentReplay: false,
    };
  });
  const sendTool = createSendMessageAgentTool(delivery.send);
  const agent = new Agent({
    initialState: {
      systemPrompt: [
        "You are a capable Personal Agent talking with one user in a private instant-message conversation. Answer the user's actual request naturally and concisely.",
        promptForVariant(promptVariant, { acknowledgement }),
      ].join("\n\n"),
      model: runtime.model,
      tools: [sendTool, ...demoTools(scenario, trace)],
      messages: [],
      thinkingLevel: "medium",
    },
    streamFn: runtime.models.streamSimple.bind(runtime.models),
    getApiKey: () => apiKey,
    sessionId: `pi-human-message:${promptVariant}:${repeat}:${scenario.id}`,
    toolExecution: "sequential",
  });

  try {
    await agent.prompt(withHumanMessageTurnReminder(scenario.prompt));
    if (agent.state.errorMessage !== undefined) throw new Error(agent.state.errorMessage);
    const state = inspectHumanMessageDelivery(trace);
    let recovered = false;
    if (state.needsRecovery) {
      recovered = true;
      const undeliveredText = messages.length === 0
        ? lastAssistantText(agent.state.messages)
        : undefined;
      agent.state.tools = [sendTool];
      await agent.prompt(createHumanMessageRecoveryPrompt({
        toolWorkAfterLastMessage: state.toolWorkAfterLastMessage,
        ...(undeliveredText === undefined
          ? {}
          : { undeliveredText }),
      }));
      if (agent.state.errorMessage !== undefined) throw new Error(agent.state.errorMessage);
    }
    const evaluation = evaluateHumanMessages(scenario, messages, trace);
    return {
      id: scenario.id,
      category: scenario.category ?? "uncategorized",
      repeat,
      passed: evaluation.passed,
      recovered,
      messages,
      trace,
      failures: evaluation.failures,
    };
  } catch (error) {
    return {
      id: scenario.id,
      category: scenario.category ?? "uncategorized",
      repeat,
      passed: false,
      recovered: false,
      messages,
      trace,
      failures: ["evaluation turn failed"],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function demoTools(
  scenario: HumanMessageBehaviorScenario,
  trace: HumanMessageTraceEvent[],
): AgentTool[] {
  if (scenario.requiredTool === undefined) return [];
  const name = scenario.requiredTool;
  const description = name === "save_note"
    ? "Quickly save a reminder or note. Use when the user clearly asks to save one."
    : name === "research_channels"
      ? "Perform the requested multi-source channel research. This is noticeable multi-step work. One call returns the complete result; never call it more than once per request."
      : "Check the current refund status. Never convert an uncertain status into success.";
  return [{
    name,
    label: name.split("_").map(capitalize).join(" "),
    description,
    parameters: Type.Object({ query: Type.Optional(Type.String()) }, { additionalProperties: false }),
    executionMode: "sequential",
    async execute() {
      const outcome = scenario.toolOutcome ?? "success";
      trace.push({ type: "tool", name, ok: outcome === "success" });
      if (outcome === "failure") {
        throw new Error("The destination is temporarily unavailable; nothing was saved.");
      }
      const payload = outcome === "uncertain"
        ? { status: "uncertain", detail: "The payment processor has not confirmed the refund." }
        : name === "research_channels"
          ? {
              status: "complete",
              conclusion: "Start with Telegram for external early adopters; add Feishu for organization workflows.",
              evidence: [
                "Telegram is the stronger external-community entry point.",
                "Feishu is the stronger organization-workflow entry point.",
              ],
            }
          : { status: "saved", noteId: "note-eval-1" };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        details: payload,
      };
    },
  }];
}

async function createRuntime(provider: string, modelId: string, apiKey: string): Promise<Runtime> {
  const credentials = new InMemoryCredentialStore();
  await credentials.modify(provider, async () => ({ type: "api_key", key: apiKey }));
  const models = createModels({ credentials });
  if (provider === "openrouter") models.setProvider(openrouterProvider());
  else if (provider === "openai") models.setProvider(openaiProvider());
  else throw new Error(`Unsupported evaluation provider ${provider}`);
  const model = models.getModel(provider, modelId);
  if (model === undefined) throw new Error(`Unknown model ${provider}/${modelId}`);
  return { model, models };
}

function resolveApiKey(provider: string): string {
  const value = process.env.PI_API_KEY?.trim()
    || (provider === "openrouter" ? process.env.OPENROUTER_API_KEY?.trim() : undefined)
    || (provider === "openai" ? process.env.OPENAI_API_KEY?.trim() : undefined);
  if (value === undefined || value.length === 0) {
    throw new Error("Set PI_API_KEY or the provider-specific API key before running real-model evals");
  }
  return value;
}

function parseAcknowledgement(raw: string | undefined): HumanMessageAcknowledgement {
  const value = raw?.trim() || "adaptive";
  if (value === "adaptive" || value === "always_before_tools" || value === "results_only") {
    return value;
  }
  throw new RangeError(
    "HUMAN_MESSAGE_ACKNOWLEDGEMENT must be adaptive, always_before_tools, or results_only",
  );
}

function parsePositiveInteger(
  raw: string | undefined,
  fallback: number,
  name: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function selectScenarios(
  scenarios: HumanMessageBehaviorScenario[],
  raw: string | undefined,
): HumanMessageBehaviorScenario[] {
  if (raw === undefined || raw.trim().length === 0) return scenarios;
  const ids = [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) throw new Error(`Unknown EVAL_IDS: ${missing.join(", ")}`);
  return ids.map((id) => byId.get(id) as HumanMessageBehaviorScenario);
}

function lastAssistantText(messages: AgentMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    const text = message.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("")
      .trim();
    if (text.length > 0) return text;
  }
  return undefined;
}

function categorySummary(results: EvalResult[]) {
  return Object.fromEntries(
    [...new Set(results.map((result) => result.category))].sort().map((category) => {
      const group = results.filter((result) => result.category === category);
      const passed = group.filter((result) => result.passed).length;
      return [category, { runs: group.length, passed, passRate: ratio(passed, group.length) }];
    }),
  );
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase()}${value.slice(1)}`;
}
