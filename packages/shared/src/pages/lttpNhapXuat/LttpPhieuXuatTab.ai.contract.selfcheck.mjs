/**
 * Run: node packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.ai.contract.selfcheck.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tabSrc = readFileSync(join(here, "LttpPhieuXuatTab.jsx"), "utf8");

assert.match(tabSrc, /AI gợi ý phiếu/);
assert.match(tabSrc, /LttpIssueSlipAiSuggestDialog/);
assert.match(tabSrc, /applyIssueSlipAiPreview/);
assert.match(tabSrc, /aiSessionId/);
assert.match(tabSrc, /useLinkLttpIssueSlipAiMemoryMutation|ai-memory\/link/);
assert.match(tabSrc, /handleApplyIssueSlipAiPreview = useCallback\(\s*\(preview,\s*meta\)/);
assert.match(tabSrc, /setAiSessionId\(meta\?\.sessionId \?\? null\)/);
assert.match(
  tabSrc,
  /await enqueueCreate\([\s\S]*?void clearIssueSlipPersist\(\);[\s\S]*?setAiSessionId\(null\)/,
);
assert.match(
  tabSrc,
  /notifySuccess\("Đã lưu phiếu xuất\."\);[\s\S]*?openSavedSlipPdf\(created\.id\);[\s\S]*?linkIssueSlipAiMemory/,
);
assert.match(tabSrc, /!isEditMode/);
assert.match(tabSrc, /headerTouched/);
assert.match(
  tabSrc,
  /Đã áp dụng \$\{appliedCount\} dòng; bỏ qua \$\{skippedCount\} dòng chưa khớp LTTP/,
);
assert.match(tabSrc, /notifySuccess/);

console.log("LttpPhieuXuatTab AI contract: ok");
