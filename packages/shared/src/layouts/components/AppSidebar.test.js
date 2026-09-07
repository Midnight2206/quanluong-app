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
  assert.match(src, /min-h-\[3\.25rem\] flex-1 min-w-\[3\.25rem\]/);
  assert.doesNotMatch(src, /min-h-\[3\.25rem\] shrink-0 min-w-\[3\.25rem\]/);
});
