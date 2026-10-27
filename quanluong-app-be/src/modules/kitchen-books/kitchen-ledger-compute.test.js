import assert from "node:assert/strict";
import test from "node:test";
import { assembleLedgerInput, fingerprintIssueSlips } from "./kitchen-ledger-assemble.js";
import { computeFinance, computeLedger, splitLedgerPages } from "./kitchen-ledger-compute.js";
import { sheetsFromLines } from "./kitchen-ledger-month-book.js";
import { toScaled } from "./kitchen-ledger-decimal.js";
import { DEFAULT_LEDGER_SETTINGS } from "./kitchen-ledger-settings.js";

function qty(value) {
  return toScaled(value);
}

function same(actual, expected) {
  assert.equal(qty(actual), qty(expected), `${actual} ≠ ${expected}`);
}

/** cktc_17.xlsx — 17/10/2026, quân số 93/99/99 · 0/0/0, thiếu 7.160. */
const CKT_17 = [
  ["Gạo tẻ thường", "Kg", "16000", "763.12", "", "", "", "1063680"],
  ["Hành tươi", "Kg", "38000", "", "0.5", "", "", "19000"],
  ["Thịt vai", "Kg", "106000", "", "12.6", "", "", "1335600"],
  ["Măng tươi", "Kg", "27000", "", "0.4", "", "", "10800"],
  ["Cá nục gai", "Kg", "44000", "", "0.5", "", "", "22000"],
  ["Trứng gà CN (16)", "Kg", "46000", "", "1.7", "", "", "78200"],
  ["Gà đùi CN", "Kg", "66000", "", "0.5", "", "", "33000"],
  ["Gừng", "Kg", "33000", "", "0.1", "", "", "3300"],
  ["Chả cá L2", "Kg", "70000", "", "6.1", "", "", "427000"],
  ["Cà chua L2", "Kg", "18000", "", "3", "", "", "54000"],
  ["Cá chim", "Kg", "44000", "", "0.6", "", "", "26400"],
  ["Bắp cải trắng", "Kg", "16000", "", "9.4", "", "", "150400"],
  ["Rau cải ngọt", "Kg", "17000", "", "0.4", "", "", "6800"],
  ["Dưa hấu L2", "Kg", "12000", "", "2", "", "20", "264000"],
  ["Rau tập tàng", "Kg", "17000", "", "2.4", "", "", "40800"],
  ["Rau canh chua", "Kg", "50000", "", "0.8", "", "", "40000"],
  ["Chuối tiêu", "Kg", "15000", "", "14.7", "", "", "220500"],
  ["Đậu phụ", "Kg", "22000", "", "", "11.9", "", "261800"],
  ["Dưa chua quả", "Kg", "15000", "", "7.3", "", "", "109500"],
  ["Su su thái", "Kg", "16000", "", "7.2", "", "", "115200"],
  ["Riềng", "Kg", "44000", "", "0.4", "", "", "17600"],
  ["Ớt quả", "Kg", "44000", "", "0.4", "", "", "17600"],
  ["Cá canh", "Kg", "50000", "", "0.4", "", "", "20000"],
  ["Thịt lợn xay", "Kg", "89000", "", "0.3", "", "6.5", "605200"],
  ["Cà rốt L2", "Kg", "15000", "", "0.5", "", "", "7500"],
  ["Bí xanh L2", "Kg", "8000", "", "10", "", "", "80000"],
  ["Sữa tươi Vinamilk 180ml", "Hộp", "8200", "", "", "", "2", "16400"],
  ["Hành tây", "Kg", "18000", "", "", "", "0.8", "14400"],
  ["Cần tây", "Kg", "28000", "", "", "", "0.4", "11200"],
  ["Ớt xào", "Kg", "44000", "", "", "", "0.2", "8800"],
  ["Mực cơm hấp loại 1", "Kg", "250000", "", "", "", "3.2", "800000"],
  ["Gà mái loại 1", "Kg", "130000", "", "", "", "6.2", "806000"],
  ["Dầu ăn cái Lân", "Lít", "47000", "47.4", "", "", "", "183300"],
  ["Nước mắm Nam Ngư STK", "Lít", "15000", "44.4", "", "", "", "73500"],
  ["Muối Iot", "Kg", "11000", "6.8", "", "", "", "13200"],
  ["Mỳ chính", "Kg", "63000", "1.5", "", "", "", "25200"],
  ["Tiêu bột", "Kg", "230000", "0.5", "", "", "", "46000"],
  ["Ớt bột", "Kg", "90000", "0.5", "", "", "", "18000"],
  ["Đường trắng", "Kg", "25000", "3.9", "", "", "", "12500"],
  ["Hành khô", "Kg", "42000", "4.1", "", "", "", "16800"],
  ["Tỏi khô", "Kg", "48000", "3.9", "", "", "", "19200"],
  ["Chất đốt", "đ", "1", "4371610", "", "", "", "215160"],
];

const HEADCOUNT_17 = {
  levels: [
    { code: "72", dailyAmount: 72000, sang: 93, trua: 99, chieu: 99 },
    { code: "130", dailyAmount: 130000, sang: 0, trua: 0, chieu: 0 },
  ],
  extras: { benhXa: 3, benhNhan: 2, omTrai: 5, leTet: 0 },
};

function ledgerFromSheet(rows, headcount, finance) {
  const openingLots = [];
  const receipts = [];
  const mealIssues = [];
  for (const [name, uom, price, opening, g, h, i, mealMoney] of rows) {
    if (opening) {
      openingLots.push({ name, uom, unitPrice: price, qty: opening, receivedDate: "2026-10-16" });
    }
    if (g) receipts.push({ name, uom, unitPrice: price, qty: g, source: "G" });
    if (h) receipts.push({ name, uom, unitPrice: price, qty: h, source: "H" });
    if (i) receipts.push({ name, uom, unitPrice: price, qty: i, source: "I" });
    if (mealMoney && Number(price)) {
      const qty = Math.round((Number(mealMoney) / Number(price)) * 10000) / 10000;
      mealIssues.push({ name, qty: String(qty), uom, unitPrice: price });
    }
  }
  return computeLedger({
    date: "2026-10-17",
    settings: DEFAULT_LEDGER_SETTINGS,
    headcount,
    openingLots,
    receipts,
    mealIssues,
    prevSurplus: finance.surplus,
    prevShortfall: finance.shortfall,
  });
}

test("13/10/2026: thu 9.953.780, chi 9.956.700, thiếu 2.920. Quân số không đổi số xuất", () => {
  const headcount = {
    levels: [
      { dailyAmount: 72000, sang: 55, trua: 87, chieu: 64 },
      { dailyAmount: 130000, sang: 35, trua: 35, chieu: 35 },
    ],
    extras: { benhXa: 3, benhNhan: 2, omTrai: 5, leTet: 0 },
  };
  const mealIssues = [{ name: "Gạo tẻ thường", qty: "72.97", uom: "Kg", unitPrice: "16000" }];
  const openingLots = [{ name: "Gạo tẻ thường", uom: "Kg", unitPrice: "16000", qty: "100", receivedDate: "2026-10-01" }];
  const issued = computeLedger({
    date: "2026-10-13",
    settings: DEFAULT_LEDGER_SETTINGS,
    headcount,
    openingLots,
    mealIssues,
  });
  const otherHead = computeLedger({
    date: "2026-10-13",
    settings: DEFAULT_LEDGER_SETTINGS,
    headcount: { levels: [{ dailyAmount: 72000, sang: 1, trua: 1, chieu: 1 }], extras: {} },
    openingLots,
    mealIssues,
  });
  same(issued.lines[0].mealQty, "72.97");
  same(otherHead.lines[0].mealQty, "72.97");
  same(computeLedger({ date: "2026-10-13", settings: DEFAULT_LEDGER_SETTINGS, headcount, openingLots }).lines[0].mealQty, "0");

  const finance = computeFinance({
    settings: DEFAULT_LEDGER_SETTINGS,
    headcount,
    prevSurplus: "11780",
    prevShortfall: "0",
    sumMealOut: "9956700",
    sumTotalOut: "9956700",
  });
  same(finance.subtotal, "9942000");
  same(finance.totalIncome, "9953780");
  same(finance.spent, "9956700");
  same(finance.shortfall, "2920");
  same(finance.surplus, "0");
});

test("cktc_17 khớp từng dòng và khối tài chính tới đồng", () => {
  const result = ledgerFromSheet(CKT_17, HEADCOUNT_17, { surplus: "9580", shortfall: "0" });
  assert.equal(result.lines.length, CKT_17.length);
  result.lines.forEach((line, index) => {
    const [name, , price, opening, g, h, i, meal] = CKT_17[index];
    assert.equal(line.name, name);
    same(line.unitPrice, price);
    same(line.openingQty, opening || "0");
    same(line.inG, g || "0");
    same(line.inH, h || "0");
    same(line.inI, i || "0");
    same(line.mealAmount, meal);
    same(line.totalOutAmount, meal);
    if (!g && !h && !i) same(line.inAmount, "0");
  });
  same(result.lines.find((line) => line.name === "Đậu phụ").inH, "11.9");
  same(result.lines.find((line) => line.name === "Gạo tẻ thường").mealQty, "66.48");
  same(result.lines.find((line) => line.name === "Gạo tẻ thường").openingAmount, "12209920");
  assert.equal(result.lines.find((line) => line.name === "Chất đốt").displayDash, true);
  same(result.totals.openingAmount, "20261530");
  same(result.totals.inAmount, "5623000");
  same(result.totals.totalInAmount, "25884530");
  same(result.totals.mealAmount, "7309540");
  same(result.totals.totalOutAmount, "7309540");
  same(result.finance.subtotal, "7292800");
  same(result.finance.totalIncome, "7302380");
  same(result.finance.spent, "7309540");
  same(result.finance.shortfall, "7160");
  same(result.finance.surplus, "0");

  const split = splitLedgerPages(result.lines);
  assert.equal(split[0].lines.length, 40);
  same(split[0].carry.openingAmount, "15702720");
  same(split[0].carry.inAmount, "5623000");
  same(split[0].carry.totalInAmount, "21325720");
  same(split[0].carry.mealAmount, "7075180");
  same(split[0].carry.totalOutAmount, "7075180");
  assert.equal(split[1].lines.length, 2);
  assert.equal(split[1].carry, null);

  const sheets = sheetsFromLines(result.lines, result.totals);
  assert.equal(sheets[0].rows.length, 40);
  assert.equal(sheets[0].carryOut.openingAmount, "15.702.720");
  assert.equal(sheets[0].carryOut.inAmount, "5.623.000");
  assert.equal(sheets[0].carryOut.totalInAmount, "21.325.720");
  assert.equal(sheets[0].carryOut.mealAmount, "7.075.180");
  assert.equal(sheets[0].carryOut.otherAmount, "");
  assert.equal(sheets[0].carryOut.totalOutAmount, "7.075.180");
  assert.equal(sheets[0].carryOut.openingQty, undefined);
  assert.deepEqual(sheets[1].carryIn, sheets[0].carryOut);
  assert.equal(sheets[1].carryOut, null);
  assert.equal(sheets[1].showTotal, true);
  assert.equal(sheets[1].showSignature, true);
  assert.equal(sheets[0].showSignature, false);
  assert.equal(sheets[1].totals.openingAmount, "20.261.530");
  assert.equal(sheets[1].totals.mealAmount, "7.309.540");
  assert.equal(sheets[1].totals.totalOutAmount, "7.309.540");
  const fuel = sheets[1].rows[1];
  assert.equal(fuel.name, "Chất đốt");
  assert.equal(fuel.price, "");
  assert.equal(fuel.openingQty, "\u2013");
  assert.equal(fuel.totalInQty, "\u2013");
  assert.equal(fuel.mealQty, "\u2013");
  assert.equal(fuel.totalOutQty, "\u2013");
  assert.equal(sheets[0].rows[0].price, "16.000");
  assert.equal(sheets[0].rows[0].openingQty, "763,12");
});

test("FIFO: hết lô giá cũ rồi mới tới lô giá mới", () => {
  const result = computeLedger({
    date: "2026-10-13",
    settings: DEFAULT_LEDGER_SETTINGS,
    headcount: {
      levels: [
        { dailyAmount: 72000, sang: 55, trua: 87, chieu: 64 },
        { dailyAmount: 130000, sang: 35, trua: 35, chieu: 35 },
      ],
      extras: { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 },
    },
    openingLots: [
      { name: "Gạo tẻ thường", uom: "Kg", unitPrice: "15000", qty: "50", receivedDate: "2026-09-01" },
    ],
    receipts: [
      { name: "Gạo tẻ thường", uom: "Kg", unitPrice: "16000", qty: "30", source: "G" },
    ],
    mealIssues: [{ name: "Gạo tẻ thường", qty: "72.97" }],
  });
  const rice = result.lines.filter((line) => line.name === "Gạo tẻ thường");
  assert.equal(rice.length, 2);
  same(rice[0].unitPrice, "15000");
  same(rice[0].mealQty, "50");
  same(rice[0].closingQty, "0");
  same(rice[1].mealQty, "22.97");
  same(rice[1].closingQty, "7.03");
  same(rice[0].mealAmount, "750000");
  same(rice[1].mealAmount, "367520");
});

test("tồn âm chỉ cảnh báo, không đề nghị số cân đối", () => {
  const before = computeLedger({
    date: "2026-10-15",
    settings: DEFAULT_LEDGER_SETTINGS,
    openingLots: [
      { name: "Mỳ chính", uom: "Kg", unitPrice: "63000", qty: "0.1", receivedDate: "2026-10-01" },
    ],
    mealIssues: [{ name: "Mỳ chính", qty: "0.4" }],
  });
  const warning = before.warnings.find((row) => row.name === "Mỳ chính");
  assert.equal(warning.code, "negative_stock");
  same(warning.shortfall, "0.3");
  assert.equal(before.suggestions.length, 0);
  assert.equal(/Đề nghị nhập/.test(warning.message), false);
  assert.equal(before.lines.find((row) => row.name === "Mỳ chính").negative, true);

  const after = computeLedger({
    date: "2026-10-15",
    settings: DEFAULT_LEDGER_SETTINGS,
    openingLots: [
      { name: "Mỳ chính", uom: "Kg", unitPrice: "63000", qty: "0.1", receivedDate: "2026-10-01" },
    ],
    receipts: [{ name: "Mỳ chính", uom: "Kg", unitPrice: "63000", qty: "1", source: "I" }],
    mealIssues: [{ name: "Mỳ chính", qty: "0.4" }],
  });
  const line = after.lines.find((row) => row.name === "Mỳ chính");
  same(line.closingQty, "0.7");
  assert.equal(line.negative, false);
});

test("tiền đã sử dụng theo cấu hình ΣS hoặc ΣO", () => {
  const base = {
    date: "2026-10-02",
    headcount: {
      levels: [{ dailyAmount: 72000, sang: 0, trua: 0, chieu: 0 }],
      extras: { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 },
    },
    openingLots: [
      { name: "Thịt vai", uom: "Kg", unitPrice: "100000", qty: "10", receivedDate: "2026-10-01" },
    ],
    otherIssues: [{ name: "Thịt vai", qty: "2" }],
    issuePolicies: { "Thịt vai": "keep" },
  };
  const byTotal = computeLedger({ ...base, settings: { ...DEFAULT_LEDGER_SETTINGS, spentBasis: "total_out" } });
  const byMeal = computeLedger({ ...base, settings: { ...DEFAULT_LEDGER_SETTINGS, spentBasis: "meal_out" } });
  same(byTotal.finance.spent, "200000");
  same(byMeal.finance.spent, "0");
});

test("assemble: không phiếu vẫn lập sổ, gạo nhập tay không cộng đôi", () => {
  const slips = [
    {
      id: 15,
      updatedAt: "2026-10-17T01:00:00.000Z",
      lines: [
        {
          commodityId: 1,
          quantity: "1.8",
          unitPrice: "16000",
          priceKind: "market",
          commodity: { name: "Gạo tẻ thường", measureUnit: "Kg" },
        },
        {
          commodityId: 2,
          quantity: "11.9",
          unitPrice: "25000",
          tgsxPrice: "22000",
          priceKind: "tgsx",
          commodity: { name: "Đậu phụ", measureUnit: "Kg" },
        },
      ],
    },
  ];
  const priceRows = [
    { commodityId: 1, name: "Gạo tẻ thường", measureUnit: "Kg", unitPrice: 16000, tgsxPrice: null },
    { commodityId: 2, name: "Đậu phụ", measureUnit: "Kg", unitPrice: 25000, tgsxPrice: 22000 },
  ];
  const open = assembleLedgerInput({
    date: "2026-10-17",
    settings: DEFAULT_LEDGER_SETTINGS,
    slips: [],
    priceRows,
    movements: [
      { kind: "self_supply", source: "I", itemName: "Hành tây", measureUnit: "Kg", qty: "0.8", unitPrice: "18000" },
    ],
  });
  assert.equal(open.blockers.length, 0);
  assert.equal(open.input.receipts.some((row) => row.source === "G" || row.source === "H"), false);
  assert.equal(open.input.receipts[0].source, "I");

  const fromSlip = assembleLedgerInput({
    date: "2026-10-17",
    settings: DEFAULT_LEDGER_SETTINGS,
    slips,
    priceRows,
  });
  const slipNames = fromSlip.input.receipts.map((row) => `${row.name}:${row.source}:${row.qty}`);
  assert.ok(slipNames.includes("Gạo tẻ thường:G:1.8"));
  assert.ok(slipNames.includes("Đậu phụ:H:11.9"));

  const built = assembleLedgerInput({
    date: "2026-10-17",
    settings: DEFAULT_LEDGER_SETTINGS,
    slips,
    priceRows,
    movements: [
      { kind: "rice", source: "J", itemName: "Gạo tẻ thường", measureUnit: "Kg", qty: "5", unitPrice: "16000" },
    ],
  });
  assert.equal(built.blockers.length, 0);
  assert.equal(built.warnings.some((row) => row.code === "rice_manual_kept"), true);
  const names = built.input.receipts.map((row) => `${row.name}:${row.source}:${row.qty}:${row.unitPrice}`);
  assert.deepEqual(names, ["Đậu phụ:H:11.9:22000", "Gạo tẻ thường:J:5:16000"]);

  const changed = fingerprintIssueSlips([
    { ...slips[0], lines: [{ ...slips[0].lines[1], quantity: "12" }] },
  ]);
  assert.notEqual(changed, built.fingerprint);
});
