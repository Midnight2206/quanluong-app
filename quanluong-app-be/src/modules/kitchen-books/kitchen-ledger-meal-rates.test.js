import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LEDGER_SETTINGS } from "./kitchen-ledger-settings.js";
import {
  alignHeadcount,
  amountsToPercents,
  applyMealLevels,
  loadMealRatePanel,
  percentsToAmounts,
  writeStandardMealSelection,
} from "./kitchen-ledger-meal-rates.js";

test("phần trăm đổi sang đồng, tổng đúng mức", () => {
  assert.deepEqual(percentsToAmounts(72000, { sang: 20, trua: 40, chieu: 40 }), {
    sang: 14400,
    trua: 28800,
    chieu: 28800,
  });
  const odd = percentsToAmounts(130000, { sang: 11.08, trua: 66.77, chieu: 22.15 });
  assert.equal(odd.sang + odd.trua + odd.chieu, 130000);
  assert.deepEqual(amountsToPercents(72000, { sang: 14400, trua: 28800, chieu: 28800 }), {
    sang: 20,
    trua: 40,
    chieu: 40,
  });
});

test("mức đơn vị thay mức mặc định và quân số khớp theo mức", () => {
  const panel = {
    selected: [
      {
        id: 9,
        mucTienAn: 72000,
        periodAmounts: { sang: 14400, trua: 28800, chieu: 28800 },
      },
    ],
  };
  const next = applyMealLevels(DEFAULT_LEDGER_SETTINGS, panel);
  assert.equal(next.levels.length, 1);
  assert.equal(next.levels[0].code, "9");
  assert.equal(next.levels[0].mealPrices.trua, 28800);
  assert.deepEqual(next.levels[0].riceGrams, DEFAULT_LEDGER_SETTINGS.levels[0].riceGrams);

  const head = alignHeadcount({
    levels: [
      { code: "72", dailyAmount: 72000, sang: 59, trua: 88, chieu: 69 },
      { code: "130", dailyAmount: 130000, sang: 3, trua: 3, chieu: 3 },
    ],
    extras: { benhXa: 1 },
  }, next.levels);
  assert.equal(head.levels.length, 1);
  assert.equal(head.levels[0].sang, 59);
  assert.equal(head.levels[0].trua, 88);
  assert.equal(head.extras.benhXa, 1);
});

test("danh mục mức kèm đúng đồng mặc định, lưu giữ nguyên khi chưa sửa phần trăm", async () => {
  const db = {
    mealAllowanceRate: {
      async findMany() {
        return [
          { id: 1, doiTuong: "Mức 72", mucTienAn: 72000, sortOrder: 1, type: "an_tieu_chuan" },
          { id: 2, doiTuong: "Mức 130", mucTienAn: 130000, sortOrder: 2, type: "an_tieu_chuan" },
        ];
      },
    },
    unitSelectedMealRate: { async findMany() { return []; } },
    unitMealPeriodSplit: { async findMany() { return []; } },
  };
  const panel = await loadMealRatePanel(db, 7, "2026-10-01", DEFAULT_LEDGER_SETTINGS.levels);
  assert.deepEqual(panel.catalog[1].periodAmounts, { sang: 14400, trua: 86800, chieu: 28800 });

  const saved = [];
  const tx = {
    mealAllowanceRate: {
      async findMany() {
        return [{ id: 2, type: "an_tieu_chuan", mucTienAn: 130000 }];
      },
    },
    unitSelectedMealRate: {
      async findMany() { return []; },
      async upsert() {},
    },
    unitMealPeriodSplit: {
      async upsert({ create }) { saved.push(create.periodAmountsJson); },
    },
  };
  await writeStandardMealSelection(tx, 7, {
    validFrom: "2026-10-01",
    rates: [{
      mealAllowanceRateId: 2,
      percents: panel.catalog[1].percents,
      periodAmounts: panel.catalog[1].periodAmounts,
    }],
  });
  assert.deepEqual(saved[0], { sang: 14400, trua: 86800, chieu: 28800 });
});
