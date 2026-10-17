import assert from "node:assert/strict";
import test from "node:test";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
};
const classes = new Set();
const root = {
  dataset: {},
  classList: {
    toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    add: (c) => classes.add(c),
    contains: (c) => classes.has(c),
  },
};
globalThis.document = { documentElement: root };

const theme = await import("./theme.js");

test("defaults: light, teal, normal contrast", () => {
  store.clear();
  assert.equal(theme.getStoredTheme(), "light");
  assert.equal(theme.getStoredAccent(), "teal");
  assert.equal(theme.getStoredHighContrast(), false);
});

test("accent: valid persisted, invalid falls back to teal", () => {
  assert.equal(theme.applyAccent("olive"), "olive");
  assert.equal(root.dataset.accent, "olive");
  assert.equal(theme.getStoredAccent(), "olive");
  assert.equal(theme.applyAccent("hotpink"), "teal");
  store.set("quanluong-ui:accent", "hotpink");
  assert.equal(theme.getStoredAccent(), "teal");
});

test("dark toggle + high contrast round-trip", () => {
  store.clear();
  theme.applyTheme("dark");
  assert.ok(classes.has("dark"));
  assert.equal(theme.getStoredTheme(), "dark");
  theme.applyHighContrast(true);
  assert.equal(root.dataset.contrast, "high");
  assert.equal(theme.getStoredHighContrast(), true);
  theme.applyHighContrast(false);
  assert.equal(root.dataset.contrast, undefined);
  theme.applyTheme("light");
  assert.ok(!classes.has("dark"));
});

test("init script restores stored values before paint", () => {
  store.clear();
  store.set("quanluong-ui:theme", "dark");
  store.set("quanluong-ui:accent", "rose");
  store.set("quanluong-ui:contrast", "high");
  classes.clear();
  root.dataset = {};
  new Function(theme.THEME_INIT_SCRIPT)();
  assert.ok(classes.has("dark"));
  assert.equal(root.dataset.accent, "rose");
  assert.equal(root.dataset.contrast, "high");
  store.set("quanluong-ui:accent", "x');alert(1);//");
  root.dataset = {};
  new Function(theme.THEME_INIT_SCRIPT)();
  assert.equal(root.dataset.accent, undefined);
});
