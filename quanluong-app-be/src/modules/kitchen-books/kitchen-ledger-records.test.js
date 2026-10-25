import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ledgerRecordBatchSchema } from "./ledgerRecords.js";
import { computeFinance, planRations } from "./kitchen-ledger-compute.js";
import { toScaled } from "./kitchen-ledger-decimal.js";
import { buildDayStructure } from "./kitchen-ledger-day-structure.js";
import { ledgerAiModels, mapLedgerRecords, recordsPrompt } from "./kitchen-ledger-records.js";
import { DEFAULT_LEDGER_SETTINGS } from "./kitchen-ledger-settings.js";

test("schema web là bản sao schema trong image backend", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const backend = readFileSync(join(here, "ledgerRecords.js"), "utf8");
  const web = readFileSync(join(here, "../../../../packages/shared/src/pages/kitchen-books/ledgerRecords.js"), "utf8");
  assert.equal(backend, web);
});

function same(actual, expected) {
  assert.equal(toScaled(actual), toScaled(expected), `${actual} ≠ ${expected}`);
}

const commodities = [
  { id: 1, name: "Mực ống", measureUnit: "Kg" },
  { id: 2, name: "Sữa đặc", measureUnit: "Hộp" },
  { id: 3, name: "Sữa tươi", measureUnit: "Hộp" },
  { id: 4, name: "Gạo tẻ", measureUnit: "Kg" },
];

test("schema từ chối bản ghi thiếu confidence, type lạ, hoặc dạng cột cũ", () => {
  assert.equal(ledgerRecordBatchSchema.safeParse({
    records: [{ type: "note", text: "thiếu mẫu", source: "a" }],
  }).success, false);
  assert.equal(ledgerRecordBatchSchema.safeParse({
    records: [{ type: "poem", text: "x", confidence: 1, source: "a" }],
  }).success, false);
  assert.equal(ledgerRecordBatchSchema.safeParse({
    lines: [{ name: "mực", intent: "unit_purchase" }],
  }).success, false);
  const parsed = ledgerRecordBatchSchema.safeParse({
    records: [{
      type: "outside_purchase",
      date: "13/10",
      name: "mực",
      qty: 5,
      unitPrice: "180k",
      column: "G",
      intent: "rice",
      confidence: 0.9,
      source: "mua mực",
    }],
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.records[0].column, undefined);
  assert.equal(parsed.data.records[0].intent, undefined);
  assert.equal(parsed.data.records[0].unitPrice, 180000);
});

test("máy chủ đặt mua ngoài vào đơn vị mua, gạo vào trên bảo đảm", () => {
  const mapped = mapLedgerRecords({
    records: [
      {
        type: "outside_purchase",
        date: "13/10/2026",
        name: "mực",
        qty: 5,
        unitPrice: "180k",
        column: "G",
        confidence: 0.9,
        source: "mua mực",
      },
      {
        type: "outside_purchase",
        date: "13/10/2026",
        name: "sữa",
        qty: 40,
        confidence: 0.4,
        source: "sữa 40 hộp",
      },
      {
        type: "stock_in",
        date: "13/10/2026",
        name: "gạo tẻ",
        qty: 10,
        origin: "unit_tgsx",
        unitPrice: 16000,
        confidence: 0.8,
        source: "gạo 10kg",
      },
      {
        type: "stock_out",
        date: "13/10/2026",
        name: "mực",
        qty: 1,
        confidence: 0.7,
        source: "xuất khác 1kg mực",
      },
    ],
  }, { commodities, anchorDate: "2026-10-13", settings: DEFAULT_LEDGER_SETTINGS });
  assert.equal(mapped.lines[0].name, "Mực ống");
  assert.equal(mapped.lines[0].source, "I");
  assert.equal(mapped.lines[0].kind, "self_supply");
  assert.equal(mapped.lines[0].place, "Đơn vị BĐ mua TT");
  assert.equal(mapped.lines[0].unitPrice, 180000);
  assert.equal(mapped.lines[0].savable, true);
  assert.equal(mapped.lines[1].savable, false);
  assert.match(mapped.lines[1].warning, /trùng tên/);
  assert.equal(mapped.lines[2].kind, "rice");
  assert.equal(mapped.lines[2].source, "G");
  assert.equal(mapped.lines[2].commodityId, 4);
  assert.equal(mapped.lines[3].kind, "other_out");
  assert.equal(mapped.lines[3].source, "P");
  assert.equal(mapped.lines[3].place, "Xuất khác");
});

test("cấu hình sai thì cả lô bị từ chối", () => {
  assert.throws(
    () => mapLedgerRecords({
      records: [{ type: "setting", field: "spentBasis", value: "nope", confidence: 1, source: "đổi quy tắc" }],
    }),
    (err) => err.statusCode === 502,
  );
  const mapped = mapLedgerRecords({
    records: [{
      type: "setting",
      field: "balanceWarnThreshold",
      value: 10000,
      confidence: 0.9,
      source: "ngưỡng 10.000",
    }],
  });
  assert.equal(mapped.proposals[0].field, "balanceWarnThreshold");
  assert.equal(mapped.proposals[0].value, 10000);
});

test("bản ghi quân số 13/10 thành quân số rồi computeFinance ra thiếu 2.920", () => {
  const mapped = mapLedgerRecords({
    records: [{
      type: "headcount",
      date: "13/10/2026",
      levels: [
        { dailyAmount: 72000, sang: 55, trua: 87, chieu: 64 },
        { dailyAmount: 130000, sang: 35, trua: 35, chieu: 35 },
      ],
      extras: { benhXa: 3, benhNhan: 2, omTrai: 5, leTet: 0 },
      confidence: 0.95,
      source: "13/10 mức 72k 55/87/64, 130k 35/35/35, bệnh xá 3, bệnh nhân 2, ốm 5",
    }],
  }, { settings: DEFAULT_LEDGER_SETTINGS, anchorDate: "2026-10-13" });
  const headcount = mapped.headcountDays[0].headcount;
  assert.equal(headcount.levels[0].sang, 55);
  assert.equal(headcount.levels[0].trua, 87);
  assert.equal(headcount.levels[1].chieu, 35);
  assert.equal(headcount.extras.benhXa, 3);
  assert.equal(headcount.extras.omTrai, 5);
  const plan = planRations({ settings: DEFAULT_LEDGER_SETTINGS, headcount });
  same(plan.riceKg, "72.97");
  same(plan.fuelAmount, "234080");
  same(plan.milkQty, "37");
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

test("khung ngày lấy cột, ô quân số và dòng thủ công từ sổ, không tự thêm cột", () => {
  const structure = buildDayStructure({
    date: "2026-10-13",
    status: "draft",
    ledgerBlocked: false,
    lines: [{ name: "Mực ống", inI: "5" }],
    totals: { inAmount: "900000" },
    finance: { totalIncome: "9953780", shortfall: "2920" },
    headcount: { levels: [{ dailyAmount: 72000 }], extras: { benhXa: 3 } },
    movements: [{ kind: "self_supply", source: "I", itemName: "Mực ống" }],
  });
  assert.equal(structure.columns.some((column) => column.key === "inI" && column.role === "manual"), true);
  assert.equal(structure.columns.some((column) => column.role === "ai"), false);
  assert.equal(structure.rows[0].tt, 1);
  assert.equal(structure.rows[0].name, "Mực ống");
  assert.deepEqual(structure.headcount.meals.map((row) => row.key), ["sang", "trua", "chieu"]);
  assert.equal(structure.headcount.values.benhXa, 3);
  assert.equal(structure.manual.selfSupply.length, 1);
  assert.equal(structure.finance.shortfall, "2920");
  const blocked = buildDayStructure({ ledgerBlocked: true, blockers: [{ message: "Thiếu phiếu xuất." }], lines: [] });
  assert.equal(blocked.rows.length, 0);
  assert.equal(blocked.note, "Thiếu phiếu xuất.");
  assert.equal(blocked.columns.length, structure.columns.length);
});

test("lời nhắc trích bản ghi không nêu cột sổ", () => {
  const prompt = recordsPrompt({
    settings: DEFAULT_LEDGER_SETTINGS,
    anchorDate: "2026-10-13",
    commodities,
  });
  assert.equal(/cột|cot [GHIJP]\b/i.test(prompt), false);
  assert.match(prompt, /"records"/);
  const prevExtract = process.env.LEDGER_AI_EXTRACT_MODEL;
  const prevQuestion = process.env.LEDGER_AI_QUESTION_MODEL;
  delete process.env.LEDGER_AI_EXTRACT_MODEL;
  delete process.env.LEDGER_AI_QUESTION_MODEL;
  assert.deepEqual(ledgerAiModels(), {
    extract: "google/gemini-3.5-flash",
    question: "google/gemini-3.8-flash",
  });
  process.env.LEDGER_AI_EXTRACT_MODEL = "google/gemini-2.5-flash";
  assert.equal(ledgerAiModels().extract, "google/gemini-2.5-flash");
  if (prevExtract == null) delete process.env.LEDGER_AI_EXTRACT_MODEL;
  else process.env.LEDGER_AI_EXTRACT_MODEL = prevExtract;
  if (prevQuestion == null) delete process.env.LEDGER_AI_QUESTION_MODEL;
  else process.env.LEDGER_AI_QUESTION_MODEL = prevQuestion;
});
