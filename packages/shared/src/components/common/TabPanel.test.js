import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./TabPanel.jsx", import.meta.url), "utf8");

test("tab panel supports disabled tabs and falls back to an enabled tab", () => {
  assert.match(source, /disabled\?: boolean/);
  assert.match(source, /const enabledTabs = tabs\.filter\(\(tab\) => !tab\.disabled\)/);
  assert.ok(source.includes("const firstEnabledId = enabledTabs[0]?.id ?? firstId;"));
  assert.match(source, /tab\.disabled \? undefined : \(\) => handleSelectTab\(tab\.id\)/);
  assert.match(source, /disabled=\{tab\.disabled\}/);
  assert.match(source, /aria-disabled=\{tab\.disabled \|\| undefined\}/);
  assert.match(source, /if \(forcedActiveTabId && validIds\.includes\(forcedActiveTabId\)\)/);
  assert.match(source, /const forcedTab = tabs\.find\(\(tab\) => tab\.id === forcedActiveTabId\)/);
  assert.match(source, /if \(forcedTab && !forcedTab\.disabled\)/);
  assert.match(source, /return tabs\.some\(\(tab\) => tab\.id === activeId && !tab\.disabled\) && activeId \? activeId : firstEnabledId;/);
});
