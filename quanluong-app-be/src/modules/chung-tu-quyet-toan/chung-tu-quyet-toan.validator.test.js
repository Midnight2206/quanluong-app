import assert from "node:assert/strict";
import test from "node:test";

import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";
import { chungTuContextPreviewBodySchema } from "./chung-tu-quyet-toan.validator.js";

test("chungTuContextPreviewBodySchema rejects phieu-xuat-kho monthly full mode", () => {
  const result = chungTuContextPreviewBodySchema.safeParse({
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
    unitId: 1,
    periodMonth: "2026-06",
    unitIds: [10, 11],
    aggregationMode: "full",
  });

  assert.equal(result.success, false);
  assert.match(
    result.error.issues.map((issue) => issue.message).join(" "),
    /Phiếu xuất kho không hỗ trợ aggregationMode full/,
  );
});

test("chungTuContextPreviewBodySchema accepts phieu-xuat-kho monthly by-day", () => {
  const result = chungTuContextPreviewBodySchema.safeParse({
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
    unitId: 1,
    periodMonth: "2026-06",
    unitIds: [10],
    aggregationMode: "by-day",
  });

  assert.equal(result.success, true);
});
