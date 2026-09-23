import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSampleDishes,
  formatSampleTextForVector,
  buildSampleVectorPayload,
} from "./kitchen-books-menu-sample-normalize.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  isQdrantEnabled,
  scheduleMenuSampleVectorUpsert,
  upsertMenuSampleVector,
} from "./kitchen-books-menu-ai-vector.js";

test("normalize rejects empty dishes", () => {
  assert.throws(() => normalizeSampleDishes([]), /ít nhất một món/);
});

test("normalize reports empty dish lines as validation error", () => {
  assert.throws(
    () => normalizeSampleDishes([{ name: "Canh", lines: [] }]),
    (error) => error.statusCode === 400 && error.code === ERROR_CODES.VALIDATION_ERROR,
  );
});

test("normalize keeps per_person line", () => {
  const out = normalizeSampleDishes([
    {
      name: " Canh  ",
      lines: [{ commodityId: 1, calcMode: "per_person", perPersonAmount: 50, perPersonUnit: "g" }],
    },
  ]);
  assert.equal(out[0].name, "Canh");
  assert.equal(out[0].lines[0].commodityId, 1);
});

test("formatSampleText includes period and rate", () => {
  const t = formatSampleTextForVector({
    mealPeriod: "trua",
    mucTienAn: 25000,
    dishes: [{ name: "Canh", lines: [{ commodityName: "Rau", calcMode: "per_person", perPersonAmount: 50, perPersonUnit: "g" }] }],
  });
  assert.match(t, /trua/);
  assert.match(t, /25000/);
  assert.match(t, /Canh/);
});

test("vector stub no-ops when disabled", async () => {
  delete process.env.QDRANT_URL;
  assert.equal(isQdrantEnabled(), false);
  const r = await upsertMenuSampleVector({ sampleId: 1 });
  assert.equal(r.skipped, true);
  scheduleMenuSampleVectorUpsert({ sampleId: 1 });
});
