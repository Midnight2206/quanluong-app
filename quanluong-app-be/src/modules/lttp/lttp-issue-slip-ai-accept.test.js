import assert from "node:assert/strict";
import test from "node:test";
import { applyScoreGate, sampleTotal, suggestAcceptRange } from "./lttp-issue-slip-ai-accept.js";

const gao = { id: 10, name: "Gạo tẻ", code: "GAO" };

test("auto accept only when the score is strictly above the admin percent", () => {
  const above = applyScoreGate(
    { commodityId: 10, confidence: 0.91, source: "score", needsConfirm: false, needsLlm: false, choices: [] },
    [gao],
    90,
  );
  assert.equal(above.needsConfirm, false);
  assert.equal(above.commodityId, 10);
  const equal = applyScoreGate(
    { commodityId: 10, confidence: 0.9, source: "score", needsConfirm: false, needsLlm: false, choices: [] },
    [gao],
    90,
  );
  assert.equal(equal.commodityId, null);
  assert.equal(equal.needsConfirm, true);
  const full = applyScoreGate(
    { commodityId: 10, confidence: 1, source: "alias", needsConfirm: false, needsLlm: false, choices: [] },
    [gao],
    100,
  );
  assert.equal(full.commodityId, null);
  assert.equal(full.needsConfirm, true);
});

test("suggested band follows how many learned samples the catalog has", () => {
  assert.equal(suggestAcceptRange(0).ready, false);
  assert.deepEqual(
    { from: suggestAcceptRange(40).from, to: suggestAcceptRange(40).to },
    { from: 95, to: 100 },
  );
  assert.deepEqual(
    { from: suggestAcceptRange(150).from, to: suggestAcceptRange(150).to },
    { from: 80, to: 90 },
  );
  assert.equal(
    sampleTotal([{ hitCount: 4 }, { hitCount: 1 }], [{ qtySamples: [1, 2, 2] }]),
    8,
  );
});
