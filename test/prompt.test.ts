import assert from "node:assert/strict";
import test from "node:test";

import {
  createHumanMessageSystemPrompt,
  HUMAN_MESSAGE_TURN_REMINDER,
  withHumanMessageTurnReminder,
} from "../src/index.js";

test("prompt leaves counts, length, and message boundaries to the agent", () => {
  const prompt = createHumanMessageSystemPrompt();
  assert.match(prompt, /Think in conversational acts, not paragraphs/u);
  assert.match(prompt, /same purpose together/u);
  assert.match(prompt, /do not force a split/u);
  assert.match(prompt, /Never split mechanically/u);
  assert.match(prompt, /no required message count or fixed reply template/u);
  assert.match(prompt, /Do not stop an authorized task/u);
  assert.doesNotMatch(prompt, /\d+ messages|\d+ characters|Shape examples/u);
  assert.match(prompt, /Do not emit Markdown headings/u);
  assert.match(prompt, /tool call ids/u);
});

test("turn reminder stays compact and follows untrusted user text", () => {
  assert.match(HUMAN_MESSAGE_TURN_REMINDER, /Plain assistant text stays private/u);
  assert.match(HUMAN_MESSAGE_TURN_REMINDER, /not a fixed count/u);
  assert.match(HUMAN_MESSAGE_TURN_REMINDER, /line break inside one call/u);
  assert.equal(
    withHumanMessageTurnReminder("用户原文"),
    `用户原文\n\n${HUMAN_MESSAGE_TURN_REMINDER}`,
  );
});

test("prompt exposes intentional acknowledgement profiles", () => {
  assert.match(
    createHumanMessageSystemPrompt({ acknowledgement: "always_before_tools" }),
    /Before using another tool/u,
  );
  assert.match(
    createHumanMessageSystemPrompt({ acknowledgement: "results_only" }),
    /Do not send a pre-work acknowledgement/u,
  );
  assert.match(
    createHumanMessageSystemPrompt({ format: "markdown", maxMessagesPerTurn: 3 }),
    /Light Markdown is available/u,
  );
});

test("prompt options fail closed", () => {
  assert.throws(
    () => createHumanMessageSystemPrompt({ maxMessagesPerTurn: 0 }),
    /positive safe integer/u,
  );
  assert.throws(
    () => createHumanMessageSystemPrompt({ acknowledgement: "sometimes" as never }),
    /acknowledgement/u,
  );
  assert.throws(
    () => createHumanMessageSystemPrompt({ preferredMaxMessageChars: 0 }),
    /preferredMaxMessageChars/u,
  );
});

test("host preferences appear only when explicitly configured", () => {
  const prompt = createHumanMessageSystemPrompt({
    maxMessagesPerTurn: 12,
    preferredMaxMessageChars: 900,
  });
  assert.match(prompt, /explicitly limits delivery to 12 messages/u);
  assert.match(prompt, /under about 900 characters/u);
});
