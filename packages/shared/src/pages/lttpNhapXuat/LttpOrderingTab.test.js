import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./LttpOrderingTab.jsx", import.meta.url), "utf8");

test("ordering table uses page scroll + StickyResponsiveTable (no nested 70vh vertical scroll)", () => {
  assert.match(source, /StickyResponsiveTable/);
  assert.match(source, /stickyLevel=\{2\}/);
  assert.doesNotMatch(source, /maxHeight:\s*["']70vh["']/);
  assert.doesNotMatch(source, /data-lttp-ordering-table-scroll[\s\S]{0,200}overflow-auto/);
});

test("mobile ordering uses single-unit pager with prev/next", () => {
  assert.match(source, /LttpOrderingMobileUnitPager/);
  assert.match(source, /data-lttp-ordering-mobile-pager/);
  assert.match(source, /Đơn vị trước/);
  assert.match(source, /Đơn vị sau/);
});

test("PNG capture uses a flat full matrix table (not StickyResponsiveTable split)", () => {
  assert.match(source, /data-lttp-ordering-table-scroll/);
  assert.match(source, /fixedPixelWidth/);
  assert.match(source, /freezeLeft=\{false\}/);
  assert.match(source, /forceShowTableForCapture/);
  const captureBlock = source.slice(source.indexOf("data-lttp-ordering-table-scroll"));
  assert.doesNotMatch(captureBlock.slice(0, 800), /StickyResponsiveTable/);
});
