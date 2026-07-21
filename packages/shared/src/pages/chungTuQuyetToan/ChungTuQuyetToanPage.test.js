import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  new URL("./ChungTuQuyetToanPage.jsx", import.meta.url),
  "utf8",
);
const categorySource = readFileSync(
  new URL("./ChungTuCategoryWorkspace.jsx", import.meta.url),
  "utf8",
);
const historySource = readFileSync(
  new URL("./ChungTuHistoryWorkspace.jsx", import.meta.url),
  "utf8",
);
const mappingSource = readFileSync(
  new URL("./ChungTuTemplateMappingPanel.jsx", import.meta.url),
  "utf8",
);

test("decision documents use a compact two-level sticky stack", () => {
  assert.doesNotMatch(
    pageSource,
    /<h1[^>]*>\s*Chứng từ quyết toán\s*<\/h1>/,
  );
  assert.match(pageSource, /stickyTabListLevel=\{0\}/);
  assert.doesNotMatch(pageSource, /shadow-soft overflow-hidden/);
  assert.match(categorySource, /stickyTabListLevel=\{1\}/);
  assert.match(historySource, /stickyLevel=\{2\}/);
  assert.match(mappingSource, /stickyLevel=\{2\}/);
  assert.doesNotMatch(
    `${historySource}\n${mappingSource}`,
    /stickyLevel=\{3\}/,
  );
});
