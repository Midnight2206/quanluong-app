import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const sharedSrc = join(here, "../..");

test("supplier nav uses shared home and flat /ncc-* paths", () => {
  const nav = readFileSync(join(here, "navConfig.js"), "utf8");
  const main = readFileSync(join(sharedSrc, "layouts/MainLayout.jsx"), "utf8");

  assert.match(nav, /export const supplierNavItems/);
  assert.match(nav, /SUPPLIER_DEFAULT_HOME/);
  assert.match(nav, /SUPPLIER_ORDER_PATH/);
  assert.match(nav, /SUPPLIER_LEDGER_PATH/);
  assert.match(nav, /SUPPLIER_INVOICE_PATH/);
  assert.match(nav, /Hoá đơn hằng ngày/);
  assert.match(main, /supplierNavItems/);
  assert.match(main, /isSupplier \? supplierNavItems/);
  assert.doesNotMatch(main, /ClientRedirect href=\{SUPPLIER/);
});
