import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./UsersPage.jsx", import.meta.url), "utf8");
const api = readFileSync(
  new URL("../../features/registrations/api/registrationsApi.js", import.meta.url),
  "utf8",
);

test("supplier review picks a partner before approve sends lttpSupplierId", () => {
  assert.match(page, /user\.type\?\.name === "lttp_supplier"/);
  assert.match(page, /useLttpSupplierCatalogQuery/);
  assert.match(page, /aria-label="Đối tác"/);
  assert.match(page, /Chọn đối tác/);
  const guard = page.indexOf("if (supplierPick && !(Number.isInteger(lttpSupplierId) && lttpSupplierId > 0))");
  const call = page.indexOf("await approve(");
  assert.ok(guard !== -1 && call !== -1 && guard < call);
  assert.match(page, /\{ userId: user\.id, lttpSupplierId \}/);
  assert.match(api, /data: \{ lttpSupplierId \}/);
});
