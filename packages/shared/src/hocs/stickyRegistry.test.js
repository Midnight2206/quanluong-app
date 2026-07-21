import assert from "node:assert/strict";
import test from "node:test";

const registryModule = await import("./stickyRegistry.js").catch(() => ({}));
const { StickyRegistry, normalizeStickyLevel } = registryModule;

test("normalizes non-negative integer sticky levels", () => {
  assert.equal(typeof normalizeStickyLevel, "function");
  assert.equal(normalizeStickyLevel("0"), 0);
  assert.equal(normalizeStickyLevel(2), 2);
  assert.equal(normalizeStickyLevel("-1"), null);
  assert.equal(normalizeStickyLevel("1.5"), null);
  assert.equal(normalizeStickyLevel("foo"), null);
});

test("keeps multiple instances at one level and uses their maximum height", () => {
  assert.equal(typeof StickyRegistry, "function");
  const registry = new StickyRegistry();
  const first = {};
  const second = {};

  registry.register(first, { level: 0, height: 40, active: true });
  registry.register(second, { level: 0, height: 56, active: true });

  assert.equal(registry.offsetFor(1), 56);
  registry.unregister(second);
  assert.equal(registry.offsetFor(1), 40);
});

test("ignores hidden instances and updates offsets after resize", () => {
  const registry = new StickyRegistry();
  const outer = {};
  const inner = {};

  registry.register(outer, { level: 0, height: 44, active: true });
  registry.register(inner, { level: 1, height: 32, active: false });
  assert.equal(registry.offsetFor(2), 44);

  registry.update(inner, { height: 36, active: true });
  assert.equal(registry.offsetFor(2), 80);

  registry.update(outer, { height: 52 });
  assert.equal(registry.offsetFor(2), 88);
});

test("unregistering an old instance cannot clear its replacement", () => {
  const registry = new StickyRegistry();
  const previous = {};
  const replacement = {};

  registry.register(previous, { level: 1, height: 30, active: true });
  registry.register(replacement, { level: 1, height: 42, active: true });
  registry.unregister(previous);

  assert.equal(registry.offsetFor(2), 42);
  assert.deepEqual(registry.levelHeights(), new Map([[1, 42]]));
});
