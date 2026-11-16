import assert from "node:assert/strict";
import test from "node:test";
import { formatInvoiceLongDate, shiftInvoiceDateYmd } from "./supplierInvoiceView.js";

test("formatInvoiceLongDate writes full Vietnamese day month year", () => {
  assert.equal(formatInvoiceLongDate("2026-11-12"), "Ngày 12 tháng 11 năm 2026");
  assert.equal(formatInvoiceLongDate("2026-01-03"), "Ngày 3 tháng 1 năm 2026");
});

test("shiftInvoiceDateYmd moves across month boundaries", () => {
  assert.equal(shiftInvoiceDateYmd("2026-11-01", -1), "2026-10-31");
  assert.equal(shiftInvoiceDateYmd("2026-11-30", 1), "2026-12-01");
});
