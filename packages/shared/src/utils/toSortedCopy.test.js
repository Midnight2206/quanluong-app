import assert from "node:assert/strict";
import test from "node:test";
import { toSortedCopy } from "./toSortedCopy.js";

const byPath = (a, b) => (a.path || "").localeCompare(b.path || "");

test("toSortedCopy returns a new array and leaves the source in place", () => {
  const units = [{ path: "b" }, { path: "a" }];
  const sorted = toSortedCopy(units, byPath);
  assert.deepEqual(sorted.map((unit) => unit.path), ["a", "b"]);
  assert.deepEqual(units.map((unit) => unit.path), ["b", "a"]);
  assert.notEqual(sorted, units);
});

test("toSortedCopy falls back to copy-then-sort when toSorted is missing", () => {
  const original = Array.prototype.toSorted;
  Array.prototype.toSorted = undefined;
  try {
    const nums = [3, 1, 2];
    const sorted = toSortedCopy(nums, (a, b) => a - b);
    assert.deepEqual(sorted, [1, 2, 3]);
    assert.deepEqual(nums, [3, 1, 2]);
  } finally {
    Array.prototype.toSorted = original;
  }
});
