import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLocalCatalogForPrompt,
  formatMenuHistoryForPrompt,
  selectHistoryDayIds,
} from "./kitchen-books-menu-ai-history.js";

test("selectHistoryDayIds prefers same weekday then recent", () => {
  // target = Friday 2026-07-24
  const target = new Date(Date.UTC(2026, 6, 24));
  const days = [
    { id: 1, menuDate: new Date(Date.UTC(2026, 6, 17)) }, // Fri
    { id: 2, menuDate: new Date(Date.UTC(2026, 6, 23)) }, // Thu
    { id: 3, menuDate: new Date(Date.UTC(2026, 6, 10)) }, // Fri
    { id: 4, menuDate: new Date(Date.UTC(2026, 6, 22)) }, // Wed
  ];
  const ids = selectHistoryDayIds(days, target, 3);
  assert.deepEqual(ids, [1, 3, 2]);
});

test("formatMenuHistoryForPrompt includes dish and commodity", () => {
  const text = formatMenuHistoryForPrompt([
    {
      menuDate: "2026-07-17",
      periods: {
        sang: {
          dishes: [
            {
              name: "Cơm tẻ",
              lines: [
                {
                  commodityName: "Gạo tẻ",
                  calcMode: "per_person",
                  perPersonAmount: 180,
                  perPersonUnit: "g",
                  peoplePerUnit: null,
                },
              ],
            },
          ],
        },
      },
    },
  ]);
  assert.match(text, /2026-07-17/);
  assert.match(text, /Cơm tẻ/);
  assert.match(text, /Gạo tẻ/);
  assert.match(text, /180\s*g/);
});

test("formatLocalCatalogForPrompt lists commodities and dishes", () => {
  const text = formatLocalCatalogForPrompt(
    [{ id: 1, name: "Gạo tẻ", code: "GAO", measureUnit: "kg" }],
    [{ name: "Cơm tẻ", lines: [{ commodityName: "Gạo tẻ" }] }],
  );
  assert.match(text, /Gạo tẻ/);
  assert.match(text, /Cơm tẻ/);
});
