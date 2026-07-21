import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./KitchenBooksPage.jsx", import.meta.url), "utf8");
const receiptWorkspaceSource = readFileSync(
  new URL("./KitchenReceiptSlipWorkspace.jsx", import.meta.url),
  "utf8",
);
const tabPanelSource = readFileSync(
  new URL("../../components/common/TabPanel.jsx", import.meta.url),
  "utf8",
);
const mealLedgerSource = readFileSync(
  new URL("../meal-roster/MealRosterLedgerTab.jsx", import.meta.url),
  "utf8",
);
const stickyTableSource = readFileSync(
  new URL("../../components/common/StickyHorizontalTable.jsx", import.meta.url),
  "utf8",
);

test("kitchen books uses the unified page scroll shell", () => {
  assert.match(pageSource, /export function KitchenBooksPage\(\)/);
  assert.doesNotMatch(pageSource, /withUnifiedPageScroll/);
  assert.doesNotMatch(
    pageSource,
    /className=["'][^"']*\boverflow-y-(?:auto|scroll)\b[^"']*["']/,
  );
});

test("nested kitchen tabs register the next sticky level", () => {
  assert.match(
    tabPanelSource,
    /data-sticky-level=\{stickyTabList \? stickyTabListLevel : undefined\}/,
  );
  assert.doesNotMatch(tabPanelSource, /:\s*"overflow-x-hidden"/);
  assert.match(receiptWorkspaceSource, /stickyTabListLevel=\{1\}/);
  assert.match(pageSource, /MealRosterLedgerTab[\s\S]*stickyTabListLevel=\{1\}/);
  assert.match(mealLedgerSource, /stickyTabListLevel=\{stickyTabListLevel \?\? 1\}/);
});

test("in-page kitchen tables do not create a vertical scroll owner", () => {
  assert.doesNotMatch(
    receiptWorkspaceSource,
    /max-h-\[[^\n"]+\][^"\n]*overflow-auto/,
  );
});

test("receipt table headers use sticky level two", () => {
  assert.match(receiptWorkspaceSource, /<StickyHorizontalTable[\s\S]*stickyLevel=\{2\}/);
  assert.match(stickyTableSource, /<UnifiedStickyRegion[\s\S]*level=\{stickyLevel\}/);
  assert.doesNotMatch(receiptWorkspaceSource, /stickyTheadClass/);
});
