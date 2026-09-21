import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const categoryConfigSource = readFileSync(new URL("./chungTuCategoryConfig.js", import.meta.url), "utf8");

test("phieu nhap kho category config uses canCuPnk and drops canCuBkmh", () => {
  assert.match(categoryConfigSource, /"canCuPnk"/);
  assert.doesNotMatch(categoryConfigSource, /"canCuBkmh"/);
});

test("category config exposes hasSummary by category", () => {
  assert.match(categoryConfigSource, /tab\.id === "bang-ke-mua-hang"/);
  assert.match(categoryConfigSource, /tab\.id === "phieu-nhap-kho"/);
  assert.match(categoryConfigSource, /tab\.id === "phieu-xuat-kho"/);
  assert.match(categoryConfigSource, /hasSummary:/);
});

test("operational PDF template categories include LTTP phiếu xuất", () => {
  assert.match(categoryConfigSource, /CHUNG_TU_OPERATIONAL_PDF_TEMPLATE_CATEGORIES/);
  assert.match(categoryConfigSource, /categoryKey: "lttp-phieu-xuat"/);
});
