import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";

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
  assert.equal(request?.init?.redirect, "error");
  assert.equal(new Headers(request?.init?.headers).get("authorization"), "Bearer secret");
  assert.equal(new Headers(request?.init?.headers).get("idempotency-key"), "tool-1");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    version: "pi-human-message.delivery.v1",
    toolCallId: "tool-1",
    text: "你好",
  });
});

test("webhook port delivers directly with the default fetch implementation", async (t) => {
  let received = "";
  const endpoint = await localEndpoint(t, (request, response) => {
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => { received += chunk; });
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ messageId: "local-delivery" }));
    });
  });
  const send = createWebhookSendMessagePort({ url: endpoint });

  assert.deepEqual(await send({ toolCallId: "local-tool", text: "hello" }), {
    messageId: "local-delivery",
    externalMessageIds: [],
    idempotentReplay: false,
  });
  assert.deepEqual(JSON.parse(received), {
    version: "pi-human-message.delivery.v1",
    toolCallId: "local-tool",
    text: "hello",
  });
});

for (const status of [307, 308]) {
  test(`webhook port rejects HTTP ${status} without forwarding a message`, async (t) => {
    let targetRequests = 0;
    let targetBody = "";
    const target = await localEndpoint(t, (request, response) => {
      targetRequests += 1;
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => { targetBody += chunk; });
      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ messageId: "redirected-delivery" }));
      });
    });
    let sourceRequests = 0;
    const source = await localEndpoint(t, (request, response) => {
      sourceRequests += 1;
      request.resume();
      request.on("end", () => {
        response.writeHead(status, { location: target });
        response.end();
      });
    });
    const send = createWebhookSendMessagePort({ url: source });

    await assert.rejects(send({ toolCallId: "redirect-tool", text: "private message" }), TypeError);
    assert.equal(sourceRequests, 1);
    assert.equal(targetRequests, 0);
    assert.equal(targetBody, "");
  });
}

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

async function localEndpoint(t: TestContext, listener: RequestListener): Promise<string> {
  const server = createServer(listener);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => { if (error) reject(error); else resolve(); });
    server.closeAllConnections();
  }));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/send`;
}
