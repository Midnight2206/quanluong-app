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
