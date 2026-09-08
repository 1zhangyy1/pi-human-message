import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public Pi extension types require the coding-agent peer", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };
  const codingAgent = "@earendil-works/pi-coding-agent";

  // The root export includes createHumanMessageExtension. Its public types
  // reference Pi even when a consumer imports only the agent-core tool.
  assert.equal(typeof manifest.peerDependencies?.[codingAgent], "string");
  assert.notEqual(manifest.peerDependenciesMeta?.[codingAgent]?.optional, true);
});
