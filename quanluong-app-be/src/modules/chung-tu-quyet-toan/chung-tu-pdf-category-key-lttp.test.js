import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const validatorSource = readFileSync(
  new URL("./chung-tu-quyet-toan.validator.js", import.meta.url),
  "utf8",
);

test("PDF template category schema allows LTTP phiếu xuất", () => {
  assert.match(
    validatorSource,
    /chungTuPdfCategoryKeySchema[\s\S]*?CHUNG_TU_CATEGORY_KEYS\.LTTP_PHIEU_XUAT/,
  );
});
