import assert from "node:assert/strict";
import test from "node:test";
import {
  getQdrantConfig,
  isQdrantEnabled,
  searchSimilarMenuDays,
  upsertMenuDayVector,
} from "./kitchen-books-menu-ai-vector.js";

test("qdrant disabled by default → upsert/search skip", async () => {
  const prev = process.env.QDRANT_URL;
  delete process.env.QDRANT_URL;
  assert.equal(isQdrantEnabled(), false);
  const up = await upsertMenuDayVector({
    menuDayId: 1,
    unitId: 1,
    menuDate: "2026-07-24",
    text: "x",
  });
  assert.equal(up.skipped, true);
  const se = await searchSimilarMenuDays({ queryText: "y", limit: 5 });
  assert.equal(se.skipped, true);
  assert.deepEqual(se.points, []);
  if (prev != null) process.env.QDRANT_URL = prev;
});

test("getQdrantConfig defaults collection name", () => {
  const prev = process.env.QDRANT_COLLECTION;
  delete process.env.QDRANT_COLLECTION;
  assert.equal(getQdrantConfig().collection, "kitchen_menu_days");
  if (prev != null) process.env.QDRANT_COLLECTION = prev;
});
