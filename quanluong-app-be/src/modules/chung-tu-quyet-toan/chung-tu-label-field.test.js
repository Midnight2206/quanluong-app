import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDerivedNamedRangeValue,
  isLabelFieldNamedRange,
} from "./chung-tu-label-field.js";

test("isLabelFieldNamedRange recognizes FIELD prefix only", () => {
  assert.equal(isLabelFieldNamedRange("FIELD_so"), true);
  assert.equal(isLabelFieldNamedRange("NL_FIELD_can_cu_pnk"), false);
  assert.equal(isLabelFieldNamedRange("so"), false);
});

test("formatDerivedNamedRangeValue preserves existing label behavior", () => {
  assert.equal(
    formatDerivedNamedRangeValue("quyenSo", "0626", { label: "Quyển số: " }),
    "Quyển số: 0626",
  );
  assert.equal(
    formatDerivedNamedRangeValue("soChungTu", "Số: 062615", { label: "Số: " }),
    "Số: 062615",
  );
  assert.equal(formatDerivedNamedRangeValue("boPhan", ""), "");
});
