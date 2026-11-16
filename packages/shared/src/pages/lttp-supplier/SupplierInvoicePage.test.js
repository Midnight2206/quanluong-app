import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));

test("SupplierInvoicePage wires daily-invoice API and PDF print", () => {
  const src = readFileSync(join(here, "SupplierInvoicePage.jsx"), "utf8");
  assert.match(src, /useLttpSupplierDailyInvoiceQuery/);
  assert.match(src, /openSupplierDailyInvoicePdfInTab/);
  assert.match(src, /Hoá đơn đã bao gồm thuế GTGT|invoice\.note/);
  assert.match(src, /formatInvoiceLongDate/);
  assert.match(src, /shiftInvoiceDateYmd/);
  assert.match(src, /Người bán hàng/);
  assert.match(src, /QUANLUONG_BRAND_LOGO_MARK_SRC/);
});

test("SupplierLedgerPage and Midnight matrix support month periodMode", () => {
  const ledger = readFileSync(join(here, "SupplierLedgerPage.jsx"), "utf8");
  const matrix = readFileSync(
    join(here, "../../../../../apps/web/app/midnight-secret/MidnightTabMatrix.jsx"),
    "utf8",
  );
  assert.match(ledger, /periodMode/);
  assert.match(ledger, /type="month"/);
  assert.match(matrix, /periodMode/);
  assert.match(matrix, /type="month"/);
});
