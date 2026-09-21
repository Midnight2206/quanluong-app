import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../..");

test("superadmin layouts hide WorkingUnitScopeBar", () => {
  const mainLayout = readFileSync(join(here, "MainLayout.jsx"), "utf8");
  assert.match(mainLayout, /showWorkingUnitScope/);
  assert.match(mainLayout, /showWorkingUnitScope \? <WorkingUnitScopeBar/);

  for (const rel of [
    "apps/superadmin/app/(private)/layout.jsx",
    "apps/superadmin/app/(main)/layout.jsx",
  ]) {
    const src = readFileSync(join(repoRoot, rel), "utf8");
    assert.match(src, /showWorkingUnitScope=\{false\}/);
  }
});
