import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("./PortalChooserPage.jsx", import.meta.url), "utf8");

test("PortalChooserPage offers work and admin CTAs", () => {
  assert.match(src, /Làm việc/);
  assert.match(src, /Quản trị/);
  assert.match(src, /getSuperadminAppOrigin/);
  assert.match(src, /\/dashboard/);
  assert.match(src, /isSuperadminUser/);
});
