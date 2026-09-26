/**
 * Run: node packages/shared/src/features/lttp/api/lttpIssueSlipAi.api.selfcheck.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = readFileSync(join(here, "lttpApi.js"), "utf8");

const hooks = [
  "useSuggestLttpIssueSlipAiMutation",
  "useChatLttpIssueSlipAiMutation",
  "useCommitLttpIssueSlipAiMemoryMutation",
  "useLinkLttpIssueSlipAiMemoryMutation",
];

for (const hook of hooks) {
  assert.match(apiSrc, new RegExp(`export function ${hook}\\(`));
}

assert.match(apiSrc, /\/lttp\/issue-slips\/ai-suggest/);
assert.match(apiSrc, /\/lttp\/issue-slips\/ai-chat/);
assert.match(apiSrc, /\/lttp\/issue-slips\/ai-memory\/commit/);
assert.match(apiSrc, /\/lttp\/issue-slips\/ai-memory\/link/);

console.log("lttpIssueSlipAi API hooks: ok");
