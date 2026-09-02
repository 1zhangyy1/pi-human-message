import assert from "node:assert/strict";
import test from "node:test";

import {
  createHumanMessageRecoveryPrompt,
  inspectHumanMessageDelivery,
} from "../src/index.js";

test("delivery inspection distinguishes silence, completion, and an unclosed tool loop", () => {
  assert.deepEqual(inspectHumanMessageDelivery([]), {
    messageCount: 0,
    toolWorkAfterLastMessage: false,
    needsRecovery: true,
  });
  assert.equal(inspectHumanMessageDelivery([
    { type: "message", text: "完成了。" },
  ]).needsRecovery, false);
  assert.deepEqual(inspectHumanMessageDelivery([
    { type: "message", text: "我先看看。" },
    { type: "tool", name: "search", ok: true },
  ]), {
    messageCount: 1,
    toolWorkAfterLastMessage: true,
    needsRecovery: true,
  });
});

test("recovery preserves a private answer and forbids invented claims", () => {
  const prompt = createHumanMessageRecoveryPrompt({
    undeliveredText: "原本应该发给用户的回答。",
    toolWorkAfterLastMessage: false,
  });
  assert.match(prompt, /原本应该发给用户的回答/u);
  assert.match(prompt, /Preserve the meaning/u);
  assert.match(prompt, /Do not add unsupported claims/u);
});
