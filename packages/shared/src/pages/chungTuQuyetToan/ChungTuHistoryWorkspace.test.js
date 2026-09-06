import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const historySrc = readFileSync(
  new URL("./ChungTuHistoryWorkspace.jsx", import.meta.url),
  "utf8",
);

test("PNK history uses summary panel instead of file accordion", () => {
  assert.match(historySrc, /phieu-nhap-kho/);
  assert.match(historySrc, /Xem tổng hợp/);
  assert.match(historySrc, /ChungTuPnkBatchSummaryPanel/);
  assert.match(historySrc, /isPnkCategory|phieu-nhap-kho/);
  assert.match(
    historySrc,
    /!isBkmhCategory && !isPnkCategory|!isPnkCategory && !isBkmhCategory/,
  );
  const fileAccordionIdx = historySrc.indexOf("File trong folder");
  assert.ok(fileAccordionIdx >= 0, "expected File trong folder block");
  assert.doesNotMatch(
    historySrc.slice(Math.max(0, fileAccordionIdx - 80), fileAccordionIdx + 40),
    /isPnkCategory\s*\?\s*.*File trong folder/,
  );
});

test("BKMH history branch unchanged", () => {
  assert.match(historySrc, /categoryKey === "bang-ke-mua-hang"/);
  assert.match(historySrc, /useChungTuBkmhMonthlyListQuery/);
  assert.match(historySrc, /ChungTuBkmhSliceSummaryPanel/);
});
