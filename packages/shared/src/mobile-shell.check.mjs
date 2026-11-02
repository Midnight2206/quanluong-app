/**
 * ponytail: rule mobile không được nằm ngoài max-width 1023px.
 * Chạy: node packages/shared/src/mobile-shell.check.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./mobile-shell.css", import.meta.url), "utf8");
const indexCss = readFileSync(new URL("./index.css", import.meta.url), "utf8");

assert.match(indexCss, /mobile-shell\.css/);

const screenStart = css.indexOf("@media (max-width: 1023px)");
const printStart = css.lastIndexOf("@media print");
assert.ok(screenStart > 0, "thiếu @media (max-width: 1023px)");
assert.ok(printStart > screenStart, "thiếu @media print sau khối mobile");

const before = css.slice(0, screenStart);
const screen = css.slice(screenStart, printStart);
assert.doesNotMatch(before, /min-height\s*:/);
assert.doesNotMatch(before, /font-size\s*:/);
assert.match(screen, /font-size:\s*16px/);
assert.match(screen, /min-height:\s*44px/);
assert.match(screen, /\.ledger-paper/);
assert.match(screen, /overflow-x:\s*auto/);
assert.match(screen, /revert-layer/);
assert.match(css.slice(printStart), /overflow:\s*visible/);

console.log("mobile-shell.check: ok");
