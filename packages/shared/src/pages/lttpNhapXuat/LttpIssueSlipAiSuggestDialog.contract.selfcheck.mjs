/**
 * Run: node packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dialogSrc = readFileSync(join(here, "LttpIssueSlipAiSuggestDialog.jsx"), "utf8");
const apiSrc = readFileSync(
  join(here, "../../features/lttp/api/lttpApi.js"),
  "utf8",
);

assert.match(dialogSrc, /AI gợi ý phiếu/);
assert.match(dialogSrc, /onApply/);
assert.match(dialogSrc, /Áp dụng/);
assert.match(dialogSrc, /Gợi ý/);
assert.match(dialogSrc, /useSuggestLttpIssueSlipAiMutation/);
assert.match(dialogSrc, /useChatLttpIssueSlipAiMutation/);
assert.match(dialogSrc, /useCommitLttpIssueSlipAiMemoryMutation/);
assert.match(dialogSrc, /notifyError/);
assert.match(dialogSrc, /sessionId/);
assert.match(dialogSrc, /ai-chat|Chat|chat/);
assert.match(dialogSrc, /ai-memory\/commit|commit/);
assert.match(apiSrc, /useSuggestLttpIssueSlipAiMutation/);
assert.match(apiSrc, /useChatLttpIssueSlipAiMutation/);
assert.match(apiSrc, /useCommitLttpIssueSlipAiMemoryMutation/);
assert.match(apiSrc, /\/lttp\/issue-slips\/ai-suggest/);
assert.match(apiSrc, /\/lttp\/issue-slips\/ai-chat/);
assert.match(apiSrc, /\/lttp\/issue-slips\/ai-memory\/commit/);

console.log("LttpIssueSlipAiSuggestDialog contract: ok");
