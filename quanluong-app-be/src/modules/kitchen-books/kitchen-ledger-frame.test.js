import assert from "node:assert/strict";
import test from "node:test";
import { assembleLedgerInput } from "./kitchen-ledger-assemble.js";
import { computeLedger } from "./kitchen-ledger-compute.js";
import { toScaled } from "./kitchen-ledger-decimal.js";
import { buildDayStructure } from "./kitchen-ledger-day-structure.js";
import { buildDayFrame } from "./kitchen-ledger-frame.js";
import { mapLedgerRecords, recordsPrompt } from "./kitchen-ledger-records.js";
import { editSlipLines, mergeSlipDraft, normalizeSlipLines } from "./kitchen-ledger-slip-roundtrip.js";

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
  const draft = frame.slipDraft.find((row) => row.name === "Mực");
  same(draft.qty, computed.suggestions.find((row) => row.name === "Mực").suggestQty);
  same(draft.qty, "5");
  const locked = buildDayFrame({ ...frame, status: "locked", suggestions: computed.suggestions, structure: {} }, slips);
  assert.equal(locked.slipDraft.length, 0);
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
  same(first.closingQty, "10");
  const day2 = run({
    date: "2026-10-14",
    slips: [{ id: 10, slipNo: 1, updatedAt: "2026-10-14T00:00:00.000Z", lines: [] }],
    openingLots: day1.computed.closingLots,
  });
  same(named(day2.computed.lines, "Mực").openingQty, "10");
  same(named(day2.frame.books.stock.rows, "Mực").openingQty, "10");
  assert.equal(day2.frame.pulled.carryFrom, "2026-10-13");
});

test("sửa phiếu và cộng cân đối rồi sổ trên bảo đảm đổi theo", () => {
  const rice = {
    id: 5,
    commodityId: 4,
    quantity: "3",
    unitPrice: "16000",
    priceKind: "market",
    commodity: { name: "Gạo tẻ", measureUnit: "Kg" },
  };
  const slips = [slipOf(2, [rice])];
  const first = run({ slips, movements: otherOut });
  same(named(first.computed.lines, "Mực").inG, "2");
  same(named(first.computed.lines, "Mực").closingQty, "-5");
  assert.equal(first.computed.lines.some((line) => line.name === "Gạo tẻ" && toScaled(line.inG) === toScaled("3")), false);
  assert.equal(first.assembled.warnings.some((row) => row.code === "rice_on_slip_ignored"), true);

  const edited = editSlipLines(normalizeSlipLines(slips), [{
    commodityId: 1,
    priceKind: "market",
    quantity: 5,
  }]);
  const editedBook = run({ slips: slipsFrom(slips, edited), movements: otherOut });
  same(named(editedBook.computed.lines, "Mực").inG, "5");

  const draft = first.frame.slipDraft.filter((row) => row.name === "Mực");
  const merged = mergeSlipDraft(normalizeSlipLines(slips), draft);
  const added = merged.find((line) => line.lineNote === "Cân đối sổ");
  same(added.quantity, "5");
  same(merged.find((line) => line.lineId === 4).quantity, "2");
  const balanced = run({ slips: slipsFrom(slips, merged), movements: otherOut });
  same(named(balanced.computed.lines, "Mực").inG, "7");
  same(named(balanced.computed.lines, "Mực").mealQty, "2");
  same(named(balanced.computed.lines, "Mực").closingQty, "0");
  assert.equal(balanced.frame.slipDraft.some((row) => row.name === "Mực"), false);
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
