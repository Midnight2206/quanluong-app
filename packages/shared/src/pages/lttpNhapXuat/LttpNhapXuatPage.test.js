import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./LttpNhapXuatPage.jsx", import.meta.url),
  "utf8",
);
const globalCss = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("LTTP toolbar replaces the page heading with compact sticky behavior", () => {
  assert.doesNotMatch(source, /<h1[^>]*>\s*Nhập xuất LTTP\s*<\/h1>/);
  assert.match(source, /toolbarSentinelRef/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /data-sticky-level="0"/);
  assert.match(source, /stickyTabListLevel=\{1\}/);
  assert.ok(
    source.indexOf("const effectiveUnitId = ownUnitId") <
      source.indexOf("}, [effectiveUnitId]);"),
    "effectiveUnitId must be initialized before the observer effect dependency array",
  );
});

test("issuing unit is pinned to the logged-in user unit — no kho picker", () => {
  assert.match(source, /ownUnitId/);
  assert.match(source, /const effectiveUnitId = ownUnitId/);
  assert.doesNotMatch(source, /manualUnitId|workingUnitId|lttp-io-unit|unitsForKhoDropdown/);
  assert.doesNotMatch(source, /<select[\s\S]*?Đơn vị cấp phát/);
  assert.match(source, /Đơn vị cấp phát/);
});

test("sticky markers override positional utility classes", () => {
  assert.match(
    globalCss,
    /\[data-sticky-level\][\s\S]*?position:\s*sticky\s*!important/,
  );
});
