import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const categoryConfigSource = readFileSync(new URL("./chungTuCategoryConfig.js", import.meta.url), "utf8");

test("phieu nhap kho category config uses canCuPnk and drops canCuBkmh", () => {
  assert.match(categoryConfigSource, /"canCuPnk"/);
  assert.doesNotMatch(categoryConfigSource, /"canCuBkmh"/);
});
