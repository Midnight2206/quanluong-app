import test from "node:test";
import assert from "node:assert/strict";
import {
  fillSignatureDatesFromPeriod,
  formatNgayThangNamLabel,
  resolveSignatureDateLabel,
} from "./chung-tu-signature-dates.util.js";
import { lastDayOfMonth } from "./chung-tu-monthly-sheets.js";

test("formatNgayThangNamLabel formats YYYY-MM-DD", () => {
  assert.equal(formatNgayThangNamLabel("2026-06-03"), "Ngày 03 tháng 06 năm 2026");
  assert.equal(formatNgayThangNamLabel(""), "");
});

test("resolveSignatureDateLabel prefers context ngayThangNam", () => {
  assert.equal(
    resolveSignatureDateLabel({
      aggregationMode: "by-day",
      periodDate: "2026-06-01",
      ngayThangNam: "Ngày 01 tháng 06 năm 2026",
      lastDayOfMonthFn: lastDayOfMonth,
    }),
    "Ngày 01 tháng 06 năm 2026",
  );
});

test("resolveSignatureDateLabel falls back to periodDate then month end", () => {
  assert.equal(
    resolveSignatureDateLabel({
      aggregationMode: "by-day",
      periodDate: "2026-06-15",
      lastDayOfMonthFn: lastDayOfMonth,
    }),
    "Ngày 15 tháng 06 năm 2026",
  );
  assert.equal(
    resolveSignatureDateLabel({
      aggregationMode: "by-unit",
      periodMonth: "2026-06",
      lastDayOfMonthFn: lastDayOfMonth,
    }),
    "Ngày 30 tháng 06 năm 2026",
  );
});

test("fillSignatureDatesFromPeriod fills show_date_line slots from slice day", () => {
  const result = fillSignatureDatesFromPeriod({
    signatureBlock: {
      slots: [
        { key: "nguoi_mua", show_date_line: true },
        { key: "thu_truong", show_date_line: false },
        { key: "ke_toan", show_date_line: true },
      ],
    },
    signatureDates: { ke_toan: "manual", other: "keep" },
    context: {
      periodDate: "2026-06-03",
      ngayThangNam: "Ngày 03 tháng 06 năm 2026",
      aggregationMode: "by-day",
    },
    aggregationMode: "by-day",
    lastDayOfMonthFn: lastDayOfMonth,
  });
  assert.equal(result.nguoi_mua, "Ngày 03 tháng 06 năm 2026");
  assert.equal(result.ke_toan, "Ngày 03 tháng 06 năm 2026");
  assert.equal(result.other, "keep");
  assert.equal(result.thu_truong, undefined);
});

test("fillSignatureDatesFromPeriod uses month end for by-unit when ngayThangNam missing", () => {
  const result = fillSignatureDatesFromPeriod({
    signatureBlock: {
      slots: [{ key: "nguoi_mua", show_date_line: true }],
    },
    context: { periodMonth: "2026-02", aggregationMode: "by-unit" },
    aggregationMode: "by-unit",
    periodMonth: "2026-02",
    lastDayOfMonthFn: lastDayOfMonth,
  });
  assert.equal(result.nguoi_mua, "Ngày 28 tháng 02 năm 2026");
});
