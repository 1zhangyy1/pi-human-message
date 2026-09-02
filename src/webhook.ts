import type {
  SendMessagePort,
  SendMessageReceipt,
} from "./tool.js";

export interface WebhookSendMessageOptions {
  /** Route-bound delivery endpoint owned by the host application. */
  url: string;
  /** Optional bearer token. Keep it outside the repository. */
  bearerToken?: string;
  /** Injectable fetch implementation for tests and non-standard runtimes. */
  fetch?: typeof globalThis.fetch;
}

export interface HumanMessageWebhookPayload {
  version: "pi-human-message.delivery.v1";
  toolCallId: string;
  text: string;
}

/**
 * Create the transport used by the installable Pi package.
 *
 * The URL is route-bound: the model never supplies a recipient, channel, or
 * conversation id. Plain HTTP is accepted only for local development.
 */
export function createWebhookSendMessagePort(
  options: WebhookSendMessageOptions,
): SendMessagePort {
  const endpoint = validateEndpoint(options.url);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required");
  }
  const bearerToken = options.bearerToken?.trim();

  return async (request, signal) => {
    const payload: HumanMessageWebhookPayload = {
      version: "pi-human-message.delivery.v1",
      toolCallId: request.toolCallId,
      text: request.text,
    };
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "idempotency-key": request.toolCallId,
    };
    if (bearerToken !== undefined && bearerToken.length > 0) {
      headers.authorization = `Bearer ${bearerToken}`;
    }

    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) {
      throw new Error(`Human-message webhook returned HTTP ${response.status}`);
    }

    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new TypeError("Human-message webhook must return a JSON delivery receipt");
    }
    return parseReceipt(value);
  };
}

function validateEndpoint(raw: string): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(raw);
  } catch {
    throw new TypeError("Webhook URL must be an absolute HTTP(S) URL");
  }
  if (endpoint.username.length > 0 || endpoint.password.length > 0) {
    throw new TypeError("Webhook URL must not contain credentials");
  }
  if (endpoint.protocol === "https:") return endpoint;
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (endpoint.protocol === "http:" && localHosts.has(endpoint.hostname)) return endpoint;
  throw new TypeError("Webhook URL must use HTTPS, except on localhost");
}

function parseReceipt(value: unknown): SendMessageReceipt {
  if (!isRecord(value) || typeof value.messageId !== "string" || value.messageId.length === 0) {
    throw new TypeError("Webhook receipt.messageId must be a non-empty string");
  }
  const externalMessageIds = value.externalMessageIds ?? [];
  if (!Array.isArray(externalMessageIds) || !externalMessageIds.every(isString)) {
    throw new TypeError("Webhook receipt.externalMessageIds must be an array of strings");
  }
  const idempotentReplay = value.idempotentReplay ?? false;
  if (typeof idempotentReplay !== "boolean") {
    throw new TypeError("Webhook receipt.idempotentReplay must be a boolean");
  }
  return {
    messageId: value.messageId,
    externalMessageIds,
    idempotentReplay,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
