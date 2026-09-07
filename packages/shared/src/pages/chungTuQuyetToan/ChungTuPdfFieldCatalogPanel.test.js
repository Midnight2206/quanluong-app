import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fieldCatalogSource = readFileSync(
  new URL("./ChungTuPdfFieldCatalogPanel.jsx", import.meta.url),
  "utf8",
);

test("field catalog panel shows one searchable scalar table", () => {
  assert.match(fieldCatalogSource, /placeholder="Tìm theo Named Range, field key hoặc mô tả"/);
  assert.match(fieldCatalogSource, /Không tìm thấy field phù hợp/);
  assert.match(fieldCatalogSource, /Mô tả/);
  assert.doesNotMatch(fieldCatalogSource, /Gợi ý tiêu đề cột bảng/);
  assert.doesNotMatch(fieldCatalogSource, /tableColumns/);
});
