import assert from "node:assert/strict";
import test from "node:test";
import { mapCommodityNameToId, normalizeCommodityName } from "./kitchen-books-menu-ai-map.js";

test("normalize strips case and diacritics", () => {
  assert.equal(normalizeCommodityName("  Gạo Tẻ  "), normalizeCommodityName("gao te"));
});

test("exact name maps", () => {
  const r = mapCommodityNameToId("Gạo tẻ", [{ id: 1, name: "Gạo tẻ", code: "GAO" }]);
  assert.equal(r.commodityId, 1);
  assert.equal(r.mapped, true);
  assert.equal(r.matchedName, "Gạo tẻ");
});

test("code maps when name misses", () => {
  const r = mapCommodityNameToId("GAO", [{ id: 1, name: "Gạo tẻ thường", code: "GAO" }]);
  assert.equal(r.commodityId, 1);
  assert.equal(r.mapped, true);
});

test("unknown returns null", () => {
  const r = mapCommodityNameToId("XYZ", [{ id: 1, name: "Gạo tẻ" }]);
  assert.equal(r.mapped, false);
  assert.equal(r.commodityId, null);
  assert.equal(r.matchedName, null);
});

test("ambiguous includes-match stays unmapped", () => {
  const r = mapCommodityNameToId("thịt", [
    { id: 1, name: "Thịt xay" },
    { id: 2, name: "Thịt vai" },
  ]);
  assert.equal(r.mapped, false);
  assert.equal(r.commodityId, null);
});

test("unambiguous includes-match maps", () => {
  const r = mapCommodityNameToId("thịt xay", [
    { id: 1, name: "Thịt xay đặc biệt" },
    { id: 2, name: "Thịt vai" },
  ]);
  assert.equal(r.commodityId, 1);
  assert.equal(r.mapped, true);
});
