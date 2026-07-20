import assert from "node:assert/strict";
import test from "node:test";
import { pickLevel1IdFromChain } from "./unit-level.pure.js";

test("pickLevel1IdFromChain: self is root", () => {
  assert.equal(pickLevel1IdFromChain([{ id: 5, depth: 0, parentId: null }]), 5);
});

test("pickLevel1IdFromChain: child picks parent depth 0", () => {
  assert.equal(
    pickLevel1IdFromChain([
      { id: 9, depth: 1, parentId: 5 },
      { id: 5, depth: 0, parentId: null },
    ]),
    5,
  );
});

test("pickLevel1IdFromChain: deep chain picks depth 0", () => {
  assert.equal(
    pickLevel1IdFromChain([
      { id: 12, depth: 2, parentId: 9 },
      { id: 9, depth: 1, parentId: 5 },
      { id: 5, depth: 0, parentId: null },
    ]),
    5,
  );
});
