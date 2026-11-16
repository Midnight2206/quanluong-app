import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("./ProfilePage.jsx", import.meta.url), "utf8");

test("profile links Zalo from the current origin and hides phone for superadmin", () => {
  assert.match(src, /Liên kết Zalo/);
  assert.match(src, /mode: "link"/);
  assert.match(src, /fromPath/);
  assert.match(src, /fromPath = "\/profile"/);
  assert.match(src, /lttp_supplier/);
  assert.match(src, /resolveZaloPortal/);
  assert.doesNotMatch(src, /origin === getSupplierAppOrigin\(\)/);
  assert.match(src, /credentials: "include"/);
  assert.match(src, /body\?\.data\?\.url/);
  assert.match(src, /window\.location\.assign\(url\)/);
  assert.match(src, /user\.zaloLinked !== true/);
  assert.match(src, /user\?\.type\?\.name === "superadmin"/);
  assert.match(src, /showPhoneField/);
  assert.match(src, /Số điện thoại/);
});
