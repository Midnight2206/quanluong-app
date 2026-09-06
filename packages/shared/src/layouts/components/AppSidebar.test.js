import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "AppSidebar.jsx"),
  "utf8",
);

test("AppSidebar supports section headers and item title", () => {
  assert.match(src, /item\.section/);
  assert.match(src, /item\.title \?\? item\.label|title=\{item\.title/);
  assert.match(src, /overflow-x-auto/);
});
