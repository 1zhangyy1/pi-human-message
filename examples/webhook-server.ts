import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import type { HumanMessageWebhookPayload } from "../src/index.js";

const port = parsePort(process.env.PORT);
const expectedToken = process.env.PI_HUMAN_MESSAGE_WEBHOOK_TOKEN?.trim();
const deliveries = new Map<string, { messageId: string; text: string }>();

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Human Message demo webhook listening on http://127.0.0.1:${port}/deliver\n`);
});

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== "POST" || request.url !== "/deliver") {
    reply(response, 404, { error: "not_found" });
    return;
  }
  if (
    expectedToken !== undefined
    && expectedToken.length > 0
    && request.headers.authorization !== `Bearer ${expectedToken}`
  ) {
    reply(response, 401, { error: "unauthorized" });
    return;
  }

  let value: unknown;
  try {
    value = JSON.parse(await readBody(request));
  } catch {
    reply(response, 400, { error: "invalid_json" });
    return;
  }
  if (!isPayload(value)) {
    reply(response, 400, { error: "invalid_payload" });
    return;
  }

  const existing = deliveries.get(value.toolCallId);
  if (existing !== undefined) {
    if (existing.text !== value.text) {
      reply(response, 409, { error: "idempotency_conflict" });
      return;
    }
    reply(response, 200, {
      messageId: existing.messageId,
      externalMessageIds: [`demo:${existing.messageId}`],
      idempotentReplay: true,
    });
    return;
  }

  const messageId = randomUUID();
  deliveries.set(value.toolCallId, { messageId, text: value.text });
  process.stdout.write(`\n┌─ chat bubble ${messageId.slice(0, 8)}\n│ ${value.text.replaceAll("\n", "\n│ ")}\n└─\n`);
  reply(response, 200, {
    messageId,
    externalMessageIds: [`demo:${messageId}`],
    idempotentReplay: false,
  });
}

function readBody(request: AsyncIterable<Uint8Array | string>): Promise<string> {
  return (async () => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > 32_000) throw new RangeError("request body too large");
      chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
  })();
}

function isPayload(value: unknown): value is HumanMessageWebhookPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === "pi-human-message.delivery.v1"
    && typeof candidate.toolCallId === "string"
    && typeof candidate.text === "string"
    && candidate.text.trim().length > 0;
}

function reply(
  response: { writeHead(status: number, headers: Record<string, string>): void; end(body: string): void },
  status: number,
  value: unknown,
): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

function parsePort(raw: string | undefined): number {
  const value = raw === undefined ? 8789 : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new RangeError("PORT must be an integer between 1 and 65535");
  }
  return value;
}
