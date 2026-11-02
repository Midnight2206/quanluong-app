import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthBook,
  countBookPages,
  daysInMonth,
  financeLines,
  formatLedgerNumber,
  sheetsFromLines,
} from "./kitchen-ledger-month-book.js";

test("format giữ đủ số lẻ, dấu . nghìn và để trống số 0", () => {
  assert.equal(formatLedgerNumber("15702720"), "15.702.720");
  assert.equal(formatLedgerNumber("763.12"), "763,12");
  assert.equal(formatLedgerNumber("0"), "");
  assert.equal(formatLedgerNumber("0.50"), "0,5");
});

test("một trang khi vừa trang; mang sang bằng cộng sang trang, chỉ cột tiền", () => {
  const line = {
    name: "Gạo",
    uom: "Kg",
    unitPrice: "16000",
    openingQty: "0",
    openingAmount: "0",
    inG: "1",
    inH: "0",
    inI: "0",
    inJ: "0",
    inAmount: "16000",
    totalInQty: "1",
    totalInAmount: "16000",
    mealQty: "1",
    mealAmount: "16000",
    otherQty: "0",
    otherAmount: "0",
    totalOutQty: "1",
    totalOutAmount: "16000",
  };
  const [only] = sheetsFromLines([line], {
    openingAmount: "0",
    inAmount: "16000",
    totalInAmount: "16000",
    mealAmount: "16000",
    otherAmount: "0",
    totalOutAmount: "16000",
  });
  assert.equal(only.carryIn, null);
  assert.equal(only.carryOut, null);
  assert.equal(only.showTotal, true);
  assert.equal(only.showSignature, true);
  assert.equal(only.rows[0].openingQty, "");
  assert.equal(only.rows[0].price, "16.000");
  assert.equal(only.rows[0].inG, "1");
  assert.equal(only.totals.otherAmount, "");
  assert.equal(only.totals.inAmount, "16.000");
});

test("chất đốt: đơn giá trống, số lượng có tiền thì gạch", () => {
  const [only] = sheetsFromLines([{
    name: "Chất đốt",
    uom: "đ",
    unitPrice: "1",
    displayDash: true,
    openingQty: "100",
    openingAmount: "100",
    inG: "0",
    inH: "0",
    inI: "0",
    inJ: "0",
    inAmount: "0",
    totalInQty: "100",
    totalInAmount: "100",
    mealQty: "40",
    mealAmount: "40",
    otherQty: "0",
    otherAmount: "0",
    totalOutQty: "40",
    totalOutAmount: "40",
  }], {});
  const row = only.rows[0];
  assert.equal(row.price, "");
  assert.equal(row.uom, "đ");
  assert.equal(row.openingQty, "\u2013");
  assert.equal(row.inI, "");
  assert.equal(row.totalInQty, "\u2013");
  assert.equal(row.mealQty, "\u2013");
  assert.equal(row.totalOutQty, "\u2013");
  assert.equal(row.openingAmount, "100");
});

test("ngày chưa chốt vào bìa, đuôi sổ để null, khối tài chính lấy chuỗi có sẵn", () => {
  assert.equal(daysInMonth(2026, 10), 31);
  assert.equal(daysInMonth(2026, 2), 28);
  const finance = financeLines({
    levels: [{
      dailyAmount: 72000,
      meals: [{ meal: "sang", headcount: "59", price: "14400", amount: "849600" }],
    }],
    extras: [{ key: "leTet", count: "0", rate: "108000", amount: "0" }],
    subtotal: "849600",
    prevSurplus: "0",
    riceSubsidy: "0",
    otherIncome: { anThem: "0", truyLinh: "0", thuKhach: "0" },
    totalIncome: "849600",
    spent: "849600",
    prevShortfall: "0",
    totalSpent: "849600",
    surplus: "0",
    shortfall: "0",
  });
  assert.equal(finance[1].value, "72.000");
  assert.equal(finance.find((row) => row.label === "+ Sáng:").value, "59 x 14.400 = 849.600");
  assert.equal(finance.find((row) => row.label.startsWith("+ Lễ")).value, "");

  const book = buildMonthBook({
    year: 2026,
    month: 10,
    unitName: "Tiểu đoàn",
    cover: { commander: "", keeper: "" },
    dayViews: [
      { date: "2026-10-01", status: "locked", lines: [], totals: {}, finance: null },
      { date: "2026-10-02", status: "draft", ledgerBlocked: true },
    ],
  });
  assert.equal(book.tail, null);
  assert.deepEqual(book.cover.draftDays, ["2026-10-02"]);
  assert.equal(book.cover.dateLine, "Ngày 01 tháng 10 năm 2026");
  assert.equal(book.days[1].note, "");
  assert.equal(book.layout.headerRowCount, 5);
  assert.equal(book.layout.leftHeader.some((cell) => cell[4] === "Mua\nTT"), true);
  assert.equal(book.layout.rowHeight, 14.55);
  assert.equal(book.days[1].financeLines.length, 0);
  assert.equal(book.days[1].sheets[0].showTotal, false);
  assert.equal(countBookPages(book), 5);
});
