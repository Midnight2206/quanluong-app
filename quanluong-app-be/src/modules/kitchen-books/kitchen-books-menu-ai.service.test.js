import assert from "node:assert/strict";
import test from "node:test";
import {
  filterMappedPeriods,
  mapLlmPeriodsToLocal,
} from "./kitchen-books-menu-ai-enrich.js";

test("filterMappedPeriods keeps mapped lines and counts drops", () => {
  const { periods, droppedLineCount } = filterMappedPeriods({
    sang: {
      dishes: [
        {
          name: "A",
          lines: [
            { commodityId: 1, mapped: true, calcMode: "per_person", perPersonAmount: 10, perPersonUnit: "g" },
            { commodityId: null, mapped: false, commodityName: "X" },
          ],
        },
        {
          name: "B",
          lines: [{ commodityId: null, mapped: false }],
        },
      ],
    },
    trua: { dishes: [] },
    chieu: { dishes: [] },
  });
  assert.equal(droppedLineCount, 2);
  assert.equal(periods.sang.dishes.length, 1);
  assert.equal(periods.sang.dishes[0].lines.length, 1);
  assert.equal(periods.sang.dishes[0].lines[0].commodityId, 1);
});

test("mapLlmPeriodsToLocal fuzzy maps names", () => {
  const { periods, warnings } = mapLlmPeriodsToLocal(
    {
      sang: {
        dishes: [
          {
            name: "Cơm",
            lines: [{ commodityName: "Gạo tẻ", calcMode: "per_person", perPersonAmount: 180, perPersonUnit: "g" }],
          },
        ],
      },
      trua: { dishes: [] },
      chieu: { dishes: [] },
    },
    [{ id: 9, name: "Gạo tẻ", code: "GAO" }],
  );
  assert.equal(periods.sang.dishes[0].lines[0].commodityId, 9);
  assert.equal(periods.sang.dishes[0].lines[0].mapped, true);
  assert.equal(warnings.length, 0);
});
