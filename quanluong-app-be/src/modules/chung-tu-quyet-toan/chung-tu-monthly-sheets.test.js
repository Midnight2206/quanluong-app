import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMonthDaySheetNames,
  normalizeMonthUnitIds,
  resolveTemplateSheetTitle,
} from "./chung-tu-monthly-sheets.js";
import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";
import { buildChungTuDocumentKey } from "./chung-tu-document-key.js";
import { isDriveFileMissingError } from "./chung-tu-drive-file-state.js";

test("buildMonthDaySheetNames returns one dd sheet per day in month", () => {
  assert.deepEqual(buildMonthDaySheetNames("2026-02"), [
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
  ]);
  assert.equal(buildMonthDaySheetNames("2024-02").length, 29);
  assert.equal(buildMonthDaySheetNames("2026-04").length, 30);
  assert.equal(buildMonthDaySheetNames("2026-05").length, 31);
});

test("normalizeMonthUnitIds removes duplicates and sorts numeric ids", () => {
  assert.deepEqual(normalizeMonthUnitIds([5, "2", 5, 1, "", null, "abc"]), [1, 2, 5]);
});

test("resolveTemplateSheetTitle prefers 01 then first existing day sheet", () => {
  assert.equal(resolveTemplateSheetTitle(["Summary", "01"]), "01");
  assert.equal(resolveTemplateSheetTitle(["Summary", "03", "15"]), "03");
  assert.equal(resolveTemplateSheetTitle(["Summary"]), "Summary");
});

test("buildChungTuDocumentKey supports monthly BKMH with selected units", () => {
  assert.equal(
    buildChungTuDocumentKey({
      categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
      periodMonth: "2026-04",
      unitIds: [3, 1, 3, 2],
    }),
    "bang-ke-mua-hang:m:2026-04:units:1,2,3",
  );
});

test("isDriveFileMissingError detects Google Drive not found responses", () => {
  assert.equal(isDriveFileMissingError({ response: { status: 404 } }), true);
  assert.equal(
    isDriveFileMissingError({
      response: { data: { error: { errors: [{ reason: "notFound" }] } } },
    }),
    true,
  );
  assert.equal(isDriveFileMissingError({ response: { status: 500 } }), false);
});
