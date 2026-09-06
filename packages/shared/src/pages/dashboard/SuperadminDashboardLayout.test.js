import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "SuperadminDashboardLayout.jsx"),
  "utf8",
);

test("SuperadminDashboardLayout has header and persist without tab strip", () => {
  assert.doesNotMatch(src, /ScrollableHorizontalStrip/);
  assert.doesNotMatch(src, /role="tablist"/);
  assert.match(src, /writePersistedNavTab/);
  assert.match(src, /Quản lý hệ thống/);
});
