import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const fullSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "DashboardTabPages.jsx"),
  "utf8",
);

const usersPageMatch = fullSrc.match(
  /export function DashboardUsersPage\(\) \{[\s\S]*?\n\}/,
);
const usersPageSrcOrFull = usersPageMatch?.[0] ?? fullSrc;

test("DashboardUsersPage renders SuperadminUsersPanel without /users deep link", () => {
  assert.doesNotMatch(usersPageSrcOrFull, /href="\/users"/);
  assert.doesNotMatch(usersPageSrcOrFull, /Mở trang Người dùng/);
  assert.match(fullSrc, /SuperadminUsersPanel/);
});
