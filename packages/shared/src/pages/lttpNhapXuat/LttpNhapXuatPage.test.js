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
    source.indexOf("const effectiveUnitId = useMemo") <
      source.indexOf("}, [canPickUnits, effectiveUnitId]);"),
    "effectiveUnitId must be initialized before the observer effect dependency array",
  );
});

test("sticky markers override positional utility classes", () => {
  assert.match(
    globalCss,
    /\[data-sticky-level\][\s\S]*?position:\s*sticky\s*!important/,
  );
});
