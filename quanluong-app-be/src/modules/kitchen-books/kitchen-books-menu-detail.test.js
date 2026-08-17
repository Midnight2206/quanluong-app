import assert from "node:assert/strict";
import test from "node:test";
import { enrichMenuDayDetail } from "./kitchen-books-menu-detail.js";

test("enrichMenuDayDetail: line/meal/day amounts + commodity totals", () => {
  const menu = {
    menuDate: "2026-07-24",
    periods: {
      sang: {
        mealPeriod: "sang",
        headcount: 34,
        dishes: [
          {
            id: 1,
            name: "Cơm tẻ",
            lines: [
              {
                commodityId: 10,
                commodity: { id: 10, name: "Gạo tẻ", measureUnit: "kg" },
                totalQuantity: "6.12",
                totalUnit: "kg",
              },
            ],
          },
          {
            id: 2,
            name: "Thịt xay",
            lines: [
              {
                commodityId: 20,
                commodity: { id: 20, name: "Thịt xay", measureUnit: "kg" },
                totalQuantity: "2.72",
                totalUnit: "kg",
              },
            ],
          },
        ],
      },
      trua: {
        mealPeriod: "trua",
        headcount: 65,
        dishes: [
          {
            id: 3,
            name: "Cơm tẻ",
            lines: [
              {
                commodityId: 10,
                commodity: { id: 10, name: "Gạo tẻ", measureUnit: "kg" },
                totalQuantity: "16.25",
                totalUnit: "kg",
              },
            ],
          },
        ],
      },
      chieu: { mealPeriod: "chieu", headcount: 0, dishes: [] },
    },
  };

  const prices = new Map([
    [10, 16000],
    [20, 95000],
  ]);

  const out = enrichMenuDayDetail(menu, prices, {
    appliedPriceTableId: 7,
    appliedEffectiveDate: "2026-07-01",
  });

  assert.equal(out.periods.sang.dishes[0].lines[0].lineAmount, 97920);
  assert.equal(out.periods.sang.dishes[1].lines[0].lineAmount, 258400);
  assert.equal(out.periods.sang.mealAmount, 356320);
  assert.equal(out.periods.trua.mealAmount, 260000);
  assert.equal(out.dayAmount, 616320);
  assert.equal(out.missingPriceCount, 0);
  assert.equal(out.appliedPriceTableId, 7);

  const gao = out.commodityTotals.find((r) => r.commodityId === 10);
  assert.equal(gao.totalQuantity, "22.37");
  assert.equal(gao.unitPrice, 16000);
  assert.equal(gao.amount, 357920);
});

test("enrichMenuDayDetail: missing price → null amounts + count", () => {
  const menu = {
    periods: {
      sang: {
        mealPeriod: "sang",
        dishes: [
          {
            id: 1,
            name: "X",
            lines: [
              {
                commodityId: 99,
                commodity: { id: 99, name: "Chưa có giá", measureUnit: "kg" },
                totalQuantity: "1",
                totalUnit: "kg",
              },
            ],
          },
        ],
      },
    },
  };
  const out = enrichMenuDayDetail(menu, new Map());
  assert.equal(out.periods.sang.dishes[0].lines[0].unitPrice, null);
  assert.equal(out.periods.sang.dishes[0].lines[0].lineAmount, null);
  assert.equal(out.periods.sang.missingPriceCount, 1);
  assert.equal(out.dayAmount, 0);
  assert.equal(out.missingPriceCount, 1);
  assert.equal(out.commodityTotals[0].amount, null);
});
