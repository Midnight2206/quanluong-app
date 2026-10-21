import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AdminAuditLogsPanel.jsx", import.meta.url), "utf8");

test("audit log tables scroll horizontally only, so vertical wheel chains to the page scroll owner", () => {
  // data-local-scroll sets overscroll-behavior: contain (both axes) in index.css,
  // which traps wheel over the wide table wrapper and sticks page scrolling.
  assert.doesNotMatch(source, /overflow-x-auto[^>]*data-local-scroll/);
  assert.match(source, /overflow-x-auto overscroll-x-contain rounded-lg border/);
});

test("usage pages detail keeps its bounded local scroll", () => {
  assert.match(source, /max-h-80 overflow-auto" data-local-scroll="true"/);
});

test("every log row has a Chi tiết button opening a modal dialog", () => {
  assert.match(source, /<Eye className="size-3\.5" aria-hidden \/>/);
  assert.match(source, /aria-label=\{`Xem chi tiết dòng nhật ký \$\{r\.id\}`\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /<LogDetailModal tab=\{tab\} row=\{detail\} onClose=\{\(\) => setDetail\(null\)\} \/>/);
  // Details open in the modal, not in inline panels above the table.
  assert.doesNotMatch(source, /openId/);
});
