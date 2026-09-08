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

test("terminal tool description is truthful about ordinary assistant output", () => {
  const tool = createSendMessageAgentTool(async ({ toolCallId }) => ({
    messageId: toolCallId,
    externalMessageIds: [],
    idempotentReplay: false,
  }), {}, "pi_terminal");
  assert.match(tool.description, /current Pi terminal/u);
  assert.match(tool.description, /ordinary assistant text/u);
  assert.doesNotMatch(tool.description, /Plain assistant text is private/u);
});

test("turn-bound delivery enforces a cap only when explicitly configured", async () => {
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

test("default delivery has no fixed count or text-length limit, including resumed turns", async () => {
  const delivered: string[] = [];
  const port = createTurnBoundSendMessagePort(async (request) => {
    delivered.push(request.text);
    return { messageId: request.toolCallId, externalMessageIds: [], idempotentReplay: false };
  }, { initialSentCount: 10 });
  const tool = createSendMessageAgentTool(port.send);
  assert.doesNotMatch(JSON.stringify(tool.parameters), /maxLength/u);
  for (let i = 0; i < 12; i += 1) {
    await tool.execute(`call-${i}`, { text: `Section ${i}: ${"detail ".repeat(1000)}` });
  }
  assert.equal(delivered.length, 12);
  assert.equal(port.sentCount, 22);
});

test("failed delivery is not counted as a delivered message", async () => {
  const port = createTurnBoundSendMessagePort(async () => {
    throw new Error("transport unavailable");
  });
  await assert.rejects(port.send({ toolCallId: "failed", text: "result" }), /transport unavailable/u);
  assert.equal(port.sentCount, 0);
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

test("a confirmed call can replay at the cap without sending again", async () => {
  let calls = 0;
  const port = createTurnBoundSendMessagePort(async ({ toolCallId }) => {
    calls += 1;
    return { messageId: toolCallId, externalMessageIds: ["platform-1"], idempotentReplay: false };
  }, { maxMessagesPerTurn: 1 });
  const request = { toolCallId: "confirmed", text: "Done." };
  const first = await port.send(request);
  first.externalMessageIds.push("caller-mutation");
  const replay = await port.send(request);
  assert.deepEqual(replay, {
    messageId: "confirmed", externalMessageIds: ["platform-1"], idempotentReplay: true,
  });
  assert.equal(port.sentCount, 1);
  assert.equal(calls, 1);
  await assert.rejects(port.send({ ...request, text: "Different message." }), /different text/u);
  await assert.rejects(port.send({ toolCallId: "new", text: "Another one." }), /turn limit reached/u);
  assert.equal(calls, 1);
});

test("a resumed full turn can look up a committed receipt without a new delivery", async () => {
  let sends = 0;
  const lookups: string[] = [];
  const controller = new AbortController();
  const port = createTurnBoundSendMessagePort(async ({ toolCallId }) => {
    sends += 1;
    return { messageId: toolCallId, externalMessageIds: [], idempotentReplay: false };
  }, {
    maxMessagesPerTurn: 1,
    initialSentCount: 1,
    lookupReceipt: async (request, signal) => {
      assert.equal(signal, controller.signal);
      lookups.push(request.toolCallId);
      return request.toolCallId === "committed"
        ? { messageId: "persisted-receipt", externalMessageIds: ["platform-1"], idempotentReplay: false }
        : undefined;
    },
  });
  const receipt = await port.send({ toolCallId: "committed", text: "Saved." }, controller.signal);
  assert.equal(receipt.messageId, "persisted-receipt");
  assert.equal(receipt.idempotentReplay, true);
  await port.send({ toolCallId: "committed", text: "Saved." }, controller.signal);
  await assert.rejects(
    port.send({ toolCallId: "new", text: "Not saved." }, controller.signal), /turn limit reached/u,
  );
  assert.deepEqual(lookups, ["committed", "new"]);
  assert.equal(port.sentCount, 1);
  assert.equal(sends, 0);
});

test("receipt lookup failure never invokes the sender", async () => {
  let sends = 0;
  const port = createTurnBoundSendMessagePort(async ({ toolCallId }) => {
    sends += 1;
    return { messageId: toolCallId, externalMessageIds: [], idempotentReplay: false };
  }, {
    maxMessagesPerTurn: 1, initialSentCount: 1,
    lookupReceipt: async () => { throw new Error("receipt store unavailable"); },
  });
  await assert.rejects(port.send({ toolCallId: "old", text: "Result" }), /receipt store unavailable/u);
  assert.equal(sends, 0);
  assert.equal(port.sentCount, 1);
});

test("reset starts a fresh receipt cache without charging late deliveries to the new turn", async () => {
  let complete!: (value: { messageId: string; externalMessageIds: string[]; idempotentReplay: boolean }) => void;
  let sends = 0;
  const port = createTurnBoundSendMessagePort(async ({ toolCallId }) => {
    sends += 1;
    if (sends === 1) return new Promise((resolve) => { complete = resolve; });
    return { messageId: toolCallId, externalMessageIds: [], idempotentReplay: false };
  }, { maxMessagesPerTurn: 1 });
  const request = { toolCallId: "old-turn", text: "Done" };
  const pending = port.send(request);
  port.reset();
  complete({ messageId: "old-turn", externalMessageIds: [], idempotentReplay: false });
  await pending;
  assert.equal(port.sentCount, 0);
  await port.send(request);
  assert.equal(sends, 2);
  assert.equal(port.sentCount, 1);
});

test("cancelled replay does not consult durable storage or return a receipt", async () => {
  let lookups = 0;
  const port = createTurnBoundSendMessagePort(async ({ toolCallId }) => ({
    messageId: toolCallId, externalMessageIds: [], idempotentReplay: false,
  }), {
    maxMessagesPerTurn: 1,
    lookupReceipt: async () => { lookups += 1; return undefined; },
  });
  await port.send({ toolCallId: "confirmed", text: "Done" });
  const signal = AbortSignal.abort(new Error("cancelled"));
  await assert.rejects(port.send({ toolCallId: "confirmed", text: "Done" }, signal), /cancelled/u);
  await assert.rejects(port.send({ toolCallId: "new", text: "Another one" }, signal), /cancelled/u);
  assert.equal(lookups, 0);
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
