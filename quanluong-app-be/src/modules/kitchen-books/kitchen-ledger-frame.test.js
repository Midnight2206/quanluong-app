import assert from "node:assert/strict";
import test from "node:test";
import { assembleLedgerInput } from "./kitchen-ledger-assemble.js";
import { computeLedger } from "./kitchen-ledger-compute.js";
import { toScaled } from "./kitchen-ledger-decimal.js";
import { buildDayStructure } from "./kitchen-ledger-day-structure.js";
import { buildDayFrame } from "./kitchen-ledger-frame.js";
import { mapLedgerRecords, recordsPrompt } from "./kitchen-ledger-records.js";
import { editSlipLines, normalizeSlipLines } from "./kitchen-ledger-slip-roundtrip.js";

function same(actual, expected) {
  assert.equal(toScaled(actual), toScaled(expected), `${actual} ≠ ${expected}`);
}

const priceRows = [{
  commodityId: 1,
  name: "Mực",
  measureUnit: "Kg",
  unitPrice: "100000",
  tgsxPrice: null,
}];

const headcount = {
  levels: [
    { dailyAmount: 72000, sang: 0, trua: 0, chieu: 0 },
    { dailyAmount: 130000, sang: 0, trua: 0, chieu: 0 },
  ],
  extras: { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 },
};

function slipOf(qty, extraLines = []) {
  return {
    id: 9,
    slipNo: 3,
    updatedAt: "2026-10-14T00:00:00.000Z",
    lines: [
      {
        id: 4,
        commodityId: 1,
        quantity: String(qty),
        unitPrice: "100000",
        tgsxPrice: null,
        priceKind: "market",
        commodity: { name: "Mực", measureUnit: "Kg" },
      },
      ...extraLines,
    ],
  };
}

function slipsFrom(slips, lines) {
  return slips.map((slip) => {
    const kept = slip.lines.map((line) => {
      const hit = lines.find((row) => row.lineId === line.id);
      return hit ? { ...line, quantity: hit.quantity, lineNote: hit.lineNote || line.lineNote || "" } : line;
    });
    const created = lines
      .filter((row) => row.slipId === slip.id && !row.lineId)
      .map((row) => ({
        commodityId: row.commodityId,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        priceKind: row.priceKind,
        lineNote: row.lineNote || "",
        commodity: { name: row.name || "Mực", measureUnit: "Kg" },
      }));
    return { ...slip, lines: [...kept, ...created] };
  });
}

function run({
  slips,
  openingLots = [],
  movements = [],
  date = "2026-10-14",
  schedule = { text: "Trực bếp sáng" },
}) {
  const assembled = assembleLedgerInput({
    date,
    settings: {},
    slips,
    movements,
    priceRows,
    priceTablePresent: true,
    openingLots,
  });
  assert.equal(assembled.blockers.length, 0, JSON.stringify(assembled.blockers));
  const computed = computeLedger({
    ...assembled.input,
    headcount,
    otherIncome: { anThem: 0, truyLinh: 0, thuKhach: 0 },
    prevSurplus: "0",
    prevShortfall: "0",
  });
  const view = {
    unitId: 7,
    date,
    status: "draft",
    headcount,
    otherIncome: { anThem: 0, truyLinh: 0, thuKhach: 0 },
    carriedFrom: openingLots.length ? "2026-10-13" : null,
    priceTable: { id: 2, effectiveDate: "2026-10-01" },
    movements,
    schedule,
    lines: computed.lines,
    totals: computed.totals,
    finance: computed.finance,
    plan: computed.plan,
    suggestions: computed.suggestions,
  };
  view.structure = buildDayStructure(view);
  return { assembled, computed, frame: buildDayFrame(view, slips) };
}

function named(lines, name) {
  const line = (lines || []).find((row) => row.name === name);
  assert.ok(line, name);
  return line;
}

const otherOut = [{
  kind: "other_out",
  itemName: "Mực",
  measureUnit: "Kg",
  qty: "5",
  commodityId: 1,
}];

test("khung ngày gom quân số, phiếu trên bảo đảm và sổ đã tính", () => {
  const slips = [slipOf(2)];
  const { computed, frame } = run({ slips, movements: otherOut });
  const muc = named(computed.lines, "Mực");
  same(muc.inG, "2");
  assert.equal(frame.unitId, 7);
  assert.equal(frame.date, "2026-10-14");
  assert.equal(frame.inputs.schedule.text, "Trực bếp sáng");
  assert.equal(frame.inputs.headcount.levels[0].dailyAmount, 72000);
  assert.equal(frame.pulled.issueSlips[0].slipNo, 3);
  assert.equal(frame.pulled.issueSlips[0].lines[0].source, "G");
  assert.equal(frame.pulled.carryFrom, null);
  assert.equal(frame.books.stock.columns.some((column) => column.key === "inG" && column.role === "slip"), true);
  assert.equal(frame.books.stock.rows.some((row) => row.name === "Mực"), true);
  assert.equal(frame.books.finance, computed.finance);
  same(muc.closingQty, "-3");
  assert.equal(frame.slipDraft.length, 0);
  assert.equal(computed.suggestions.length, 0);
});

test("tồn cuối ngày trước là tồn đầu ngày sau", () => {
  const day1 = run({
    date: "2026-10-13",
    slips: [slipOf(2)],
    openingLots: [{
      name: "Mực",
      uom: "Kg",
      unitPrice: "100000",
      qty: "10",
      commodityId: 1,
      receivedDate: "2026-10-01",
      role: "fresh",
    }],
  });
  const first = named(day1.computed.lines, "Mực");
  same(first.openingQty, "10");
  same(first.inG, "2");
  same(first.mealQty, "0");
  same(first.closingQty, "12");
  const day2 = run({
    date: "2026-10-14",
    slips: [{ id: 10, slipNo: 1, updatedAt: "2026-10-14T00:00:00.000Z", lines: [] }],
    openingLots: day1.computed.closingLots,
  });
  same(named(day2.computed.lines, "Mực").openingQty, "12");
  same(named(day2.frame.books.stock.rows, "Mực").openingQty, "12");
  assert.equal(day2.frame.pulled.carryFrom, "2026-10-13");
});

test("sửa phiếu đổi G/H, gạo nhập tay không bị phiếu ghi đè", () => {
  const rice = {
    id: 5,
    commodityId: 4,
    quantity: "3",
    unitPrice: "16000",
    priceKind: "market",
    commodity: { name: "Gạo tẻ", measureUnit: "Kg" },
  };
  const ricePrice = { commodityId: 4, name: "Gạo tẻ", measureUnit: "Kg", unitPrice: "16000", tgsxPrice: null };
  const slips = [slipOf(2, [rice])];
  const first = run({ slips, movements: otherOut });
  first.assembled = assembleLedgerInput({
    date: "2026-10-14",
    settings: {},
    slips,
    movements: otherOut,
    priceRows: [...priceRows, ricePrice],
    priceTablePresent: true,
  });
  const withRice = assembleLedgerInput({
    date: "2026-10-14",
    settings: {},
    slips,
    movements: otherOut,
    priceRows: [...priceRows, ricePrice],
  });
  assert.equal(withRice.input.receipts.some((row) => row.name === "Gạo tẻ" && row.source === "G"), true);
  const manual = assembleLedgerInput({
    date: "2026-10-14",
    settings: {},
    slips,
    movements: [
      ...otherOut,
      { kind: "rice", source: "I", itemName: "Gạo tẻ", measureUnit: "Kg", qty: "1", unitPrice: "16000" },
    ],
    priceRows: [...priceRows, ricePrice],
  });
  const riceLines = manual.input.receipts.filter((row) => row.name === "Gạo tẻ");
  assert.equal(riceLines.length, 1);
  assert.equal(riceLines[0].source, "I");
  same(riceLines[0].qty, "1");

  const edited = editSlipLines(normalizeSlipLines(slips), [{
    commodityId: 1,
    priceKind: "market",
    quantity: 5,
  }]);
  const editedBook = run({ slips: slipsFrom(slips, edited), movements: otherOut });
  same(named(editedBook.computed.lines, "Mực").inG, "5");
  assert.equal(editedBook.frame.slipDraft.length, 0);
  assert.equal(edited.some((line) => line.lineNote === "Cân đối sổ"), false);
});

test("lịch làm việc là bản ghi chữ, máy chủ không tính từ đó", () => {
  const mapped = mapLedgerRecords({
    records: [{
      type: "schedule",
      date: "14/10/2026",
      text: "Trực bếp sáng, nghỉ chiều",
      confidence: 0.8,
      source: "lịch trực",
    }],
  }, { anchorDate: "2026-10-14", settings: {} });
  assert.equal(mapped.schedules[0].date, "2026-10-14");
  assert.equal(mapped.schedules[0].text, "Trực bếp sáng, nghỉ chiều");
  assert.equal(mapped.lines.length, 0);
  assert.equal(mapped.headcountDays.length, 0);
  const prompt = recordsPrompt({ anchorDate: "2026-10-14", settings: {} });
  assert.match(prompt, /type schedule/);
  assert.equal(/cột|cot [GHIJP]\b/i.test(prompt), false);
});
