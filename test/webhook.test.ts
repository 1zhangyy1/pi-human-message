import assert from "node:assert/strict";
import test from "node:test";

import { createWebhookSendMessagePort } from "../src/webhook.js";

test("webhook port posts one route-bound message and maps its receipt", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const send = createWebhookSendMessagePort({
    url: "https://delivery.example.test/current-conversation",
    bearerToken: "secret",
    fetch: (async (input, init) => {
      request = { url: String(input), ...(init === undefined ? {} : { init }) };
      return Response.json({
        messageId: "delivery-1",
        externalMessageIds: ["telegram-9"],
        idempotentReplay: false,
      });
    }) as typeof fetch,
  });

  const receipt = await send({ toolCallId: "tool-1", text: "你好" });
  assert.deepEqual(receipt, {
    messageId: "delivery-1",
    externalMessageIds: ["telegram-9"],
    idempotentReplay: false,
  });
  assert.equal(request?.url, "https://delivery.example.test/current-conversation");
  assert.equal(new Headers(request?.init?.headers).get("authorization"), "Bearer secret");
  assert.equal(new Headers(request?.init?.headers).get("idempotency-key"), "tool-1");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    version: "pi-human-message.delivery.v1",
    toolCallId: "tool-1",
    text: "你好",
  });
});

test("webhook port accepts local HTTP but rejects unsafe remote endpoints", () => {
  assert.doesNotThrow(() => createWebhookSendMessagePort({ url: "http://127.0.0.1:8787/send" }));
  assert.throws(
    () => createWebhookSendMessagePort({ url: "http://example.com/send" }),
    /must use HTTPS/u,
  );
  assert.throws(
    () => createWebhookSendMessagePort({ url: "https://user:pass@example.com/send" }),
    /must not contain credentials/u,
  );
});

test("webhook port fails closed on HTTP errors and invalid receipts", async () => {
  const failed = createWebhookSendMessagePort({
    url: "https://delivery.example.test/send",
    fetch: (async () => new Response("no", { status: 503 })) as typeof fetch,
  });
  await assert.rejects(
    failed({ toolCallId: "tool-1", text: "hello" }),
    /HTTP 503/u,
  );

  const invalid = createWebhookSendMessagePort({
    url: "https://delivery.example.test/send",
    fetch: (async () => Response.json({ ok: true })) as typeof fetch,
  });
  await assert.rejects(
    invalid({ toolCallId: "tool-2", text: "hello" }),
    /receipt\.messageId/u,
  );
});
