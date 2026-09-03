import assert from "node:assert/strict";
import test from "node:test";

import {
  createSendMessageAgentTool,
  createTurnBoundSendMessagePort,
  SEND_MESSAGE_TOOL_NAME,
  type SendMessageRequest,
} from "../src/index.js";

test("send_message delivers one route-bound bubble and returns its receipt", async () => {
  const requests: SendMessageRequest[] = [];
  const tool = createSendMessageAgentTool(async (request) => {
    requests.push(request);
    return {
      messageId: "message-1",
      externalMessageIds: ["platform-1"],
      idempotentReplay: false,
    };
  });

  const result = await tool.execute("call-1", { text: "  我先看看。  " });
  assert.equal(tool.name, SEND_MESSAGE_TOOL_NAME);
  assert.doesNotMatch(JSON.stringify(tool.parameters), /channel|recipient/u);
  assert.deepEqual(requests, [{ toolCallId: "call-1", text: "我先看看。" }]);
  assert.equal(result.details.messageId, "message-1");
  assert.match(tool.description, /complete thought/u);
});

test("turn-bound delivery enforces and resets the hard message cap", async () => {
  const delivered: string[] = [];
  const controller = createTurnBoundSendMessagePort(async ({ toolCallId, text }) => {
    delivered.push(text);
    return { messageId: toolCallId, externalMessageIds: [], idempotentReplay: false };
  }, { maxMessagesPerTurn: 2 });

  await controller.send({ toolCallId: "1", text: "一" });
  await controller.send({ toolCallId: "2", text: "二" });
  await assert.rejects(
    controller.send({ toolCallId: "3", text: "三" }),
    /turn limit reached/u,
  );
  assert.equal(controller.sentCount, 2);
  controller.reset();
  await controller.send({ toolCallId: "4", text: "新一轮" });
  assert.deepEqual(delivered, ["一", "二", "新一轮"]);
});

test("turn-bound delivery resumes from already committed messages", async () => {
  const delivered: string[] = [];
  const port = createTurnBoundSendMessagePort(async (request) => {
    delivered.push(request.text);
    return {
      messageId: `message-${delivered.length}`,
      externalMessageIds: [],
      idempotentReplay: false,
    };
  }, { maxMessagesPerTurn: 2, initialSentCount: 1 });

  assert.equal(port.sentCount, 1);
  await port.send({ toolCallId: "call-2", text: "second" });
  await assert.rejects(
    port.send({ toolCallId: "call-3", text: "third" }),
    /turn limit reached/u,
  );
  assert.deepEqual(delivered, ["second"]);
});

test("idempotent delivery replay does not consume another message slot", async () => {
  const delivered: string[] = [];
  const port = createTurnBoundSendMessagePort(async (request) => {
    delivered.push(request.text);
    return {
      messageId: request.toolCallId,
      externalMessageIds: [],
      idempotentReplay: request.text === "replay",
    };
  }, { maxMessagesPerTurn: 2, initialSentCount: 1 });

  await port.send({ toolCallId: "call-1", text: "replay" });
  assert.equal(port.sentCount, 1);
  await port.send({ toolCallId: "call-2", text: "new" });
  assert.equal(port.sentCount, 2);
  assert.deepEqual(delivered, ["replay", "new"]);
});

test("send_message rejects empty and over-limit bubbles before delivery", async () => {
  let calls = 0;
  const tool = createSendMessageAgentTool(async () => {
    calls += 1;
    return { messageId: "never", externalMessageIds: [], idempotentReplay: false };
  }, { maxMessageChars: 8 });

  await assert.rejects(tool.execute("empty", { text: "   " }), /must not be empty/u);
  await assert.rejects(tool.execute("long", { text: "123456789" }), /must not exceed/u);
  assert.equal(calls, 0);
});
