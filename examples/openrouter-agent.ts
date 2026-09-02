import { Agent } from "@earendil-works/pi-agent-core";
import { createModels, InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";

import {
  createHumanMessageSystemPrompt,
  createSendMessageAgentTool,
  withHumanMessageTurnReminder,
} from "../src/index.js";

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) throw new Error("Set OPENROUTER_API_KEY before running this example");

const credentials = new InMemoryCredentialStore();
await credentials.modify("openrouter", async () => ({ type: "api_key", key: apiKey }));
const models = createModels({ credentials });
models.setProvider(openrouterProvider());
const modelId = process.env.PI_MODEL?.trim() || "openai/gpt-5.6-luna";
const model = models.getModel("openrouter", modelId);
if (!model) throw new Error(`Unknown OpenRouter model ${modelId}`);

const delivered: string[] = [];
const sendMessage = createSendMessageAgentTool(async ({ toolCallId, text }) => {
  delivered.push(text);
  process.stdout.write(`\nchat bubble ${delivered.length}: ${text}\n`);
  return {
    messageId: toolCallId,
    externalMessageIds: [`demo-${delivered.length}`],
    idempotentReplay: false,
  };
});

const agent = new Agent({
  initialState: {
    systemPrompt: [
      "You are a capable Personal Agent in a private chat.",
      createHumanMessageSystemPrompt(),
    ].join("\n\n"),
    model,
    tools: [sendMessage],
    messages: [],
    thinkingLevel: "medium",
  },
  streamFn: models.streamSimple.bind(models),
  getApiKey: () => apiKey,
  toolExecution: "sequential",
});

await agent.prompt(withHumanMessageTurnReminder(
  process.argv.slice(2).join(" ")
    || "详细但像聊天一样说说，为什么不应该按标点机械拆消息。",
));
