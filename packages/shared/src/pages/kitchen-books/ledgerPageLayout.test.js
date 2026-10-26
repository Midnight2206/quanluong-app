import assert from "node:assert/strict";
import test from "node:test";
import { LEDGER_BODY_COLUMNS, headerCoverage, ledgerHeaderRows } from "./ledgerPageLayout.js";
import { percentsToAmounts, percentSum } from "./ledgerMealSplit.js";

test("header trang trái + trang phải phủ kín 20 cột, không chồng", () => {
  const rows = ledgerHeaderRows("Ngày 01 tháng 10 năm 2026");
  const grid = headerCoverage(rows);
  assert.equal(grid.length, 4);
  assert.equal(grid[0].length, LEDGER_BODY_COLUMNS.length);
  assert.equal(grid[0][0], "tt");
  assert.equal(grid[0][1], "name");
  assert.equal(grid[3][6], "g");
  assert.equal(grid[3][9], "j");
  assert.equal(grid[0][19], "cktc");
  assert.equal(rows[0].at(-1).dateLine, "Ngày 01 tháng 10 năm 2026");
});

test("20/40/40 của 72.000 ra đúng tiền bữa trên sổ", () => {
  assert.deepEqual(percentsToAmounts(72000, { sang: 20, trua: 40, chieu: 40 }), {
    sang: 14400,
    trua: 28800,
    chieu: 28800,
  });
  assert.equal(percentSum({ sang: 20, trua: 40, chieu: 40 }), 100);
  assert.equal(percentSum({ sang: 30, trua: 30, chieu: 30 }), 90);
});
