import assert from "node:assert/strict";
import test from "node:test";
import { hasTgsxSignal, dropTgsxUnlessSignaled } from "./lttp-issue-slip-ai-tgsx.js";

test("hasTgsxSignal detects keywords", () => {
  assert.equal(hasTgsxSignal(["mua TT 10kg gao"]), false);
  assert.equal(hasTgsxSignal(["lay TGSX ga"]), true);
  assert.equal(hasTgsxSignal(["gia san xuat"]), true);
});

test("dropTgsxUnlessSignaled removes tgsx when no signal", () => {
  const { lines, warnings } = dropTgsxUnlessSignaled({
    lines: [
      { commodityName: "A", priceKind: "market" },
      { commodityName: "A", priceKind: "tgsx" },
    ],
    signalTexts: ["xuat mua TT"],
    warnings: [],
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].priceKind, "market");
  assert.ok(warnings.some((w) => /tgsx/i.test(w)));
});

test("dropTgsxUnlessSignaled keeps tgsx when signaled", () => {
  const { lines } = dropTgsxUnlessSignaled({
    lines: [
      { commodityName: "A", priceKind: "market" },
      { commodityName: "A", priceKind: "tgsx" },
    ],
    signalTexts: ["can TGSX"],
    warnings: [],
  });
  assert.equal(lines.length, 2);
});
