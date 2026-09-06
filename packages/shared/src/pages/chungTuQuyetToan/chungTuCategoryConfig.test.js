import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const categoryConfigSource = readFileSync(new URL("./chungTuCategoryConfig.js", import.meta.url), "utf8");

test("phieu nhap kho category config uses canCuPnk and drops canCuBkmh", () => {
  assert.match(categoryConfigSource, /"canCuPnk"/);
  assert.doesNotMatch(categoryConfigSource, /"canCuBkmh"/);
});

test("category config exposes hasSummary by category", () => {
  assert.match(
    categoryConfigSource,
    /hasSummary:\s*tab\.id === "bang-ke-mua-hang"\s*\|\|\s*tab\.id === "phieu-nhap-kho"/,
  );
  assert.doesNotMatch(
    categoryConfigSource,
    /hasSummary:\s*tab\.id === "bang-ke-mua-hang"\s*\|\|\s*tab\.id === "phieu-xuat-kho"/,
  );
});
