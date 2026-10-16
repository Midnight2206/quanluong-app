import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("./LoginPage.jsx", import.meta.url), "utf8");

test("LoginPage uses resolvePostLoginPath and Google from chooser", () => {
  assert.match(src, /resolvePostLoginPath/);
  assert.match(src, /SUPERADMIN_PORTAL_CHOOSER_PATH/);
  assert.match(src, /login\(values\)\.unwrap\(\)/);
  assert.match(src, /searchParams\.get\("portal"\) === "admin"/);
  assert.match(src, /getSuperadminAppOrigin/);
});

test("LoginPage offers Zalo except on the superadmin origin", () => {
  assert.match(src, /Đăng nhập bằng Zalo/);
  assert.match(src, /getSuperadminAppOrigin/);
  assert.match(src, /window\.location\.origin !== getSuperadminAppOrigin\(\)/);
  assert.match(src, /origin === getSupplierAppOrigin\(\) \? "supplier" : "main"/);
});

test("ZaloContinuePage polls the attempt and skips the API when OAuth is pending", () => {
  const page = readFileSync(new URL("./ZaloContinuePage.jsx", import.meta.url), "utf8");
  assert.match(page, /Xác minh số điện thoại/);
  assert.match(page, /await_phone/);
  assert.match(page, /ZaloPhoneQr/);
  assert.match(page, /ZaloPhoneOpen/);
  assert.match(page, /dán phiếu này/);
  assert.match(page, /Mở app Zalo/);
  assert.match(page, /lg:hidden/);
  assert.match(page, /hidden lg:block/);
  assert.match(page, /toDataURL/);
  assert.doesNotMatch(page, /href=\{attempt\.miniAppUrl\}/);
  assert.match(page, /2000/);
  assert.match(page, /credentials: "include"/);
  assert.match(page, /searchParams\.get\("branch"\) === "pending"/);
  assert.match(page, /if \(!ticket\)/);
  assert.match(page, /useGetRegisterUnitsQuery/);
  assert.match(page, /navigateAfterLogin/);
  assert.match(page, /readOnly/);
  for (const code of ["no_phone", "id_mismatch", "expired", "ambiguous", "superadmin", "taken"]) {
    assert.match(page, new RegExp(code));
  }
});
