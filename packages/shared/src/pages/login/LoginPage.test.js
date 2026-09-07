import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("./LoginPage.jsx", import.meta.url), "utf8");

test("LoginPage uses resolvePostLoginPath and Google from chooser", () => {
  assert.match(src, /resolvePostLoginPath/);
  assert.match(src, /SUPERADMIN_PORTAL_CHOOSER_PATH/);
  assert.match(src, /login\(values\)\.unwrap\(\)/);
});
