import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BA_DOC_KEYS, detectSecrets } from "../src/modules/ba-profiles/ba-profiles.utils.js";
import { QUY_TAC_FILES, assertSeedKeys, resolveQuyTacDir, titleOf } from "./ba-seed-baseline.js";

test("mọi BA_DOC_KEYS là kebab-case và vừa cột VarChar(40)", () => {
  for (const key of BA_DOC_KEYS) {
    assert.ok(key.length <= 40 && key.length > 0, key);
    assert.match(key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
});

test("seed quy-tac-phu-luc: docKey trong allow-list, file là bản kcal in gần chuẩn", async () => {
  assertSeedKeys(QUY_TAC_FILES);
  assert.equal(QUY_TAC_FILES["quy-tac-phu-luc"], "10_phu_luc_cuoi_so.md");
  assert.ok(BA_DOC_KEYS.includes("quy-tac-phu-luc"));
  const dir = resolveQuyTacDir();
  const md = await readFile(path.join(dir, QUY_TAC_FILES["quy-tac-phu-luc"]), "utf8");
  assert.match(titleOf(md, "x"), /Phụ lục cuối Sổ nhập xuất LTTP/);
  assert.match(md, /Cột Nhiệt lượng IN trên V\.n/);
  assert.match(md, /printed = std \+ min\(80/);
  assert.equal(md.includes("khi thực tế vượt chuẩn"), false);
  assert.deepEqual(detectSecrets(md), []);
});
