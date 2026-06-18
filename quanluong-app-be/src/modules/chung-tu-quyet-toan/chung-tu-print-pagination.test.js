import test from "node:test";
import assert from "node:assert/strict";

import { buildChungTuSheetPrintRows, paginateChungTuPrintRows } from "./chung-tu-print-pagination.js";

test("paginateChungTuPrintRows inserts cumulative carry rows between pages", () => {
  const pages = paginateChungTuPrintRows({
    rows: [
      { stt: 1, tenHang: "Gạo", thanhTien: "10.000" },
      { stt: 2, tenHang: "Thịt", thanhTien: "20.000" },
      { stt: 3, tenHang: "Rau", thanhTien: "30.000" },
      { stt: 4, tenHang: "Cá", thanhTien: "40.000" },
      { stt: 5, tenHang: "Muối", thanhTien: "50.000" },
    ],
    firstPageBodyHeight: 80,
    nextPageBodyHeight: 80,
    rowHeight: () => 20,
    carryRowHeight: 20,
    transferRowHeight: 20,
    amountFieldKey: "thanhTien",
  });

  assert.equal(pages.length, 2);
  assert.equal(pages[0].carryIn, 0);
  assert.equal(pages[0].pageAmount, 60000);
  assert.equal(pages[0].carryOut, 60000);
  assert.deepEqual(
    pages[0].rows.map((row) => row.stt),
    [1, 2, 3],
  );
  assert.equal(pages[1].carryIn, 60000);
  assert.equal(pages[1].pageAmount, 90000);
  assert.equal(pages[1].carryOut, null);
  assert.deepEqual(
    pages[1].rows.map((row) => row.stt),
    [4, 5],
  );
});

test("paginateChungTuPrintRows keeps empty documents printable", () => {
  const pages = paginateChungTuPrintRows({
    rows: [],
    firstPageBodyHeight: 80,
    nextPageBodyHeight: 80,
    amountFieldKey: "thanhTien",
  });

  assert.deepEqual(pages, [
    {
      pageIndex: 0,
      carryIn: 0,
      pageAmount: 0,
      carryOut: null,
      rows: [],
      rowHeights: [],
    },
  ]);
});

test("paginateChungTuPrintRows reserves carry slots for 40-row sheet pages", () => {
  const pages = paginateChungTuPrintRows({
    rows: Array.from({ length: 50 }, (_, i) => ({
      stt: i + 1,
      tenHang: `Hàng ${i + 1}`,
      thanhTien: "1.000",
    })),
    firstPageBodyHeight: 40,
    nextPageBodyHeight: 40,
    rowHeight: () => 1,
    carryRowHeight: 1,
    transferRowHeight: 1,
    amountFieldKey: "thanhTien",
  });
  assert.equal(pages.length, 2);
  assert.equal(pages[0].rows.length, 39);
  assert.equal(pages[0].carryOut, 39000);
  assert.equal(pages[1].carryIn, 39000);
  assert.equal(pages[1].rows.length, 11);
  assert.equal(pages[1].carryOut, null);
});

test("buildChungTuSheetPrintRows injects carry rows for Google Sheets table values", () => {
  const values = buildChungTuSheetPrintRows({
    detailRows: [
      { stt: 1, tenHang: "Gạo", thanhTien: "10.000" },
      { stt: 2, tenHang: "Thịt", thanhTien: "20.000" },
      { stt: 3, tenHang: "Rau", thanhTien: "30.000" },
      { stt: 4, tenHang: "Cá", thanhTien: "40.000" },
      { stt: 5, tenHang: "Muối", thanhTien: "50.000" },
    ],
    columns: ["stt", "tenHang", "thanhTien"],
    pageRowsFirst: 3,
    pageRowsNext: 3,
    amountFieldKey: "thanhTien",
    carryInLabel: "Mang sang",
    carryOutLabel: "Cộng sang trang",
  });

  assert.deepEqual(values, [
    [1, "Gạo", "10.000"],
    [2, "Thịt", "20.000"],
    ["", "Cộng sang trang", 30000],
    ["", "Mang sang", 30000],
    [3, "Rau", "30.000"],
    ["", "Cộng sang trang", 60000],
    ["", "Mang sang", 60000],
    [4, "Cá", "40.000"],
    [5, "Muối", "50.000"],
  ]);
});
