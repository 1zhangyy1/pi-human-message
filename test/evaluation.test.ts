import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateHumanMessages,
  type HumanMessageBehaviorScenario,
} from "../src/index.js";

const scenario: HumanMessageBehaviorScenario = {
  id: "two-beats",
  prompt: "分两条说",
  minMessages: 2,
  maxMessages: 2,
  maxCharsPerMessage: 30,
};

test("evaluation accepts two compact distinct messages", () => {
  assert.equal(evaluateHumanMessages(scenario, ["先给结论。", "然后说下一步。"]).passed, true);
});

test("evaluation rejects duplicate, report-shaped, and excessive output", () => {
  const result = evaluateHumanMessages(scenario, ["## 结论\n**可以**", "## 结论\n**可以**"]);
  assert.equal(result.passed, false);
  assert.equal(result.failures.includes("duplicate messages detected"), true);
  assert.equal(result.failures.some((failure) => failure.includes("Markdown")), true);
});

test("evaluation checks both sides of a tool loop", () => {
  const toolScenario: HumanMessageBehaviorScenario = {
    id: "research",
    prompt: "研究",
    minMessages: 2,
    maxMessages: 3,
    maxCharsPerMessage: 100,
    requiredTool: "research",
    requireMessageBeforeTool: true,
    requireMessageAfterTool: true,
  };
  const result = evaluateHumanMessages(toolScenario, ["我先查。"], [
    { type: "message", text: "我先查。" },
    { type: "tool", name: "research", ok: true },
  ]);
  assert.equal(result.passed, false);
  assert.equal(result.failures.some((failure) => failure.includes("after research")), true);
});

test("evaluation can cap repeated tool work", () => {
  const toolScenario: HumanMessageBehaviorScenario = {
    id: "one-research-call",
    prompt: "调研",
    minMessages: 1,
    maxMessages: 2,
    maxCharsPerMessage: 100,
    requiredTool: "research",
    maxToolCalls: 1,
  };
  const result = evaluateHumanMessages(toolScenario, ["结论。"], [
    { type: "tool", name: "research", ok: true },
    { type: "tool", name: "research", ok: true },
    { type: "message", text: "结论。" },
  ]);
  assert.equal(result.passed, false);
  assert.equal(result.failures.some((failure) => failure.includes("called 2 times")), true);
});

test("evaluation accepts cautious uncertainty language without substring false positives", () => {
  const uncertain: HumanMessageBehaviorScenario = {
    id: "uncertain",
    prompt: "退款了吗",
    minMessages: 1,
    maxMessages: 1,
    maxCharsPerMessage: 100,
    requiredAnyPhrases: ["不能确认", "尚未确认"],
    forbiddenPhrases: ["已到账"],
  };
  assert.equal(
    evaluateHumanMessages(uncertain, ["目前还不能确认退款是否成功。派单方尚未确认。"]).passed,
    true,
  );
});
