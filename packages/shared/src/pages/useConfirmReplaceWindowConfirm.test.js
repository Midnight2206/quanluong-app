import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nativeConfirmPattern = new RegExp(["window", "confirm"].join("\\."));

const files = [
  {
    label: "chung tu history workspace",
    source: readFileSync(new URL("./chungTuQuyetToan/ChungTuHistoryWorkspace.jsx", import.meta.url), "utf8"),
    expectAwaitCount: 2,
  },
  {
    label: "profile page",
    source: readFileSync(new URL("./profile/ProfilePage.jsx", import.meta.url), "utf8"),
    expectAwaitCount: 1,
  },
  {
    label: "kitchen menu tab",
    source: readFileSync(new URL("./kitchen-books/KitchenMenuTab.jsx", import.meta.url), "utf8"),
    expectAwaitCount: 4,
  },
  {
    label: "kitchen menu ai suggest dialog",
    source: readFileSync(new URL("./kitchen-books/KitchenMenuAiSuggestDialog.jsx", import.meta.url), "utf8"),
    expectAwaitCount: 1,
  },
];

test("shared pages use ConfirmProvider instead of native confirm", () => {
  for (const { label, source, expectAwaitCount } of files) {
    assert.doesNotMatch(source, nativeConfirmPattern, `${label} should not use native confirm`);
    assert.match(source, /useConfirm/, `${label} should import or use useConfirm`);
    assert.equal(
      [...source.matchAll(/await confirm\(/g)].length,
      expectAwaitCount,
      `${label} should await confirm the expected number of times`,
    );
  }
});
