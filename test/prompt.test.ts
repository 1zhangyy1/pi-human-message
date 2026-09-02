import assert from "node:assert/strict";
import test from "node:test";

import {
  createHumanMessageSystemPrompt,
  HUMAN_MESSAGE_TURN_REMINDER,
  withHumanMessageTurnReminder,
} from "../src/index.js";

test("prompt keeps message boundaries agent-authored and bounded", () => {
  const prompt = createHumanMessageSystemPrompt();
  assert.match(prompt, /Multi-message output is an option, not a target/u);
  assert.match(prompt, /Never split mechanically/u);
  assert.match(prompt, /no more than 4 messages/u);
  assert.match(prompt, /decide the small number/u);
  assert.match(prompt, /under about 700 characters/u);
  assert.match(prompt, /Do not emit Markdown headings/u);
  assert.match(prompt, /tool call ids/u);
});

test("turn reminder stays compact and follows untrusted user text", () => {
  assert.match(HUMAN_MESSAGE_TURN_REMINDER, /Plain assistant text stays private/u);
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
    /between 1 and 8/u,
  );
  assert.throws(
    () => createHumanMessageSystemPrompt({ acknowledgement: "sometimes" as never }),
    /acknowledgement/u,
  );
  assert.throws(
    () => createHumanMessageSystemPrompt({ preferredMaxMessageChars: 39 }),
    /preferredMaxMessageChars/u,
  );
});
