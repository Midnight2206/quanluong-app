import assert from "node:assert/strict";
import test from "node:test";
import { diffHeadcount, normalizeAiHeadcount } from "./kitchen-ledger-ai-headcount.js";

const anchor = "2026-10-21";

function day(date, a, b, extra = {}) {
  return {
    date,
    levels: [
      { dailyAmount: 72000, sang: a[0], trua: a[1], chieu: a[2], confidence: extra.confidence ?? 0.95 },
      { dailyAmount: 130000, sang: b[0], trua: b[1], chieu: b[2], confidence: extra.confidence ?? 0.95 },
    ],
    extras: extra.extras === null ? undefined : {
      benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0, confidence: 0.9, ...(extra.extras || {}),
    },
  };
}

function meals(result, date, amount) {
  const row = result.days.find((item) => item.date === date);
  const level = row.headcount.levels.find((item) => item.dailyAmount === amount);
  return [level.sang, level.trua, level.chieu];
}

test("tin quân số 18-21/10 và như 17/10 ra đúng mức", () => {
  const result = normalizeAiHeadcount({
    days: [
      day("18/10", [91, 97, 97], [0, 0, 0]),
      day("19/10", [91, 120, 100], [0, 0, 0]),
      day("20/10", [51, 81, 61], [40, 40, 40]),
      day("21/10", [51, 84, 64], [40, 40, 40]),
      day("22/10", [93, 99, 99], [0, 0, 0]),
    ],
  }, { settings: null, anchorDate: anchor });
  assert.deepEqual(result.days.map((item) => item.date), [
    "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
  ]);
  assert.deepEqual(meals(result, "2026-10-18", 72000), [91, 97, 97]);
  assert.deepEqual(meals(result, "2026-10-19", 72000), [91, 120, 100]);
  assert.deepEqual(meals(result, "2026-10-20", 130000), [40, 40, 40]);
  assert.deepEqual(meals(result, "2026-10-21", 72000), [51, 84, 64]);
  assert.deepEqual(meals(result, "2026-10-22", 72000), [93, 99, 99]);
});

test("quân số sai mẫu, ngày lặp, mức lạ và confidence phần trăm", () => {
  assert.throws(() => normalizeAiHeadcount({ days: [] }, { settings: null, anchorDate: anchor }), (err) => err.statusCode === 502);
  assert.throws(() => normalizeAiHeadcount({
    days: [{ date: "không ngày", levels: [{ dailyAmount: 72000, sang: 1, trua: 1, chieu: 1 }] }],
  }, { settings: null, anchorDate: anchor }), (err) => err.statusCode === 502);
  const result = normalizeAiHeadcount({
    days: [
      day("18/10", [1, 1, 1], [0, 0, 0]),
      {
        date: "18/10",
        levels: [
          { dailyAmount: 72000, counts: { sang: 91, trua: 97, chieu: 97 }, confidence: 90 },
          { dailyAmount: 99999, sang: 5, trua: 5, chieu: 5 },
          { dailyAmount: 130000, sang: 0, trua: 0, chieu: 0 },
        ],
      },
    ],
  }, { settings: null, anchorDate: anchor });
  assert.equal(result.days.length, 1);
  assert.deepEqual(meals(result, "2026-10-18", 72000), [91, 97, 97]);
  assert.equal(result.days[0].confidence.levels[0].sang, 0.9);
  assert.match(result.days[0].warnings.join(" "), /99999/);
  assert.match(result.days[0].warnings.join(" "), /ăn thêm/);
});

test("diff quân số chỉ ghi ô người dùng sửa", () => {
  const draft = {
    date: "2026-10-18",
    headcount: {
      levels: [
        { dailyAmount: 72000, sang: 91, trua: 97, chieu: 97 },
        { dailyAmount: 130000, sang: 0, trua: 0, chieu: 0 },
      ],
      extras: { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 },
    },
  };
  const changes = diffHeadcount(draft, {
    levels: [
      { dailyAmount: 72000, sang: 90, trua: 97, chieu: 97 },
      { dailyAmount: 130000, sang: 0, trua: 0, chieu: 0 },
    ],
    extras: { benhXa: 1, benhNhan: 0, omTrai: 0, leTet: 0 },
  });
  assert.deepEqual(changes, [
    { date: "2026-10-18", field: "72000.sang", from: 91, to: 90 },
    { date: "2026-10-18", field: "extras.benhXa", from: 0, to: 1 },
  ]);
});
