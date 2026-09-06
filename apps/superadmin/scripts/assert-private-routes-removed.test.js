import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const privateRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../app/(private)",
);

for (const rel of ["lttp-nhap-xuat", "users", "so-sach-bep-an", "meal-roster"]) {
  test(`superadmin private route removed: ${rel}`, () => {
    assert.equal(existsSync(join(privateRoot, rel)), false);
  });
}
