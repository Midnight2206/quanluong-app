import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AppBrand.jsx", import.meta.url), "utf8");

test("AppBrand shows slogan under site name and Midnight ring around the logo", () => {
  assert.match(source, /QUANLUONG_SITE_SLOGAN/);
  assert.match(source, /MidnightLogoRing/);
  assert.match(source, /Midnight · Midnight · Midnight ·/);
  assert.match(source, /textPath/);
  assert.match(source, /ql-brand-text/);
  assert.match(source, /var\(--ql-brand-from\)/);
  assert.match(source, /ql-brand-mark/);
});
