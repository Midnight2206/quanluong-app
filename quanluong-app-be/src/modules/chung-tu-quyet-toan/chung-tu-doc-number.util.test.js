import test from "node:test";
import assert from "node:assert/strict";
import {
  padDocNumber,
  quyenSoFromPeriodMonth,
  buildSheetKey,
} from "./chung-tu-doc-number.util.js";

test("padDocNumber pads to 4", () => {
  assert.equal(padDocNumber(1), "0001");
  assert.equal(padDocNumber(12), "0012");
});

test("quyenSoFromPeriodMonth", () => {
  assert.equal(quyenSoFromPeriodMonth("2026-09"), "0926");
});

test("buildSheetKey variants", () => {
  assert.equal(buildSheetKey({ kind: "by-unit", recipientUnitId: 5 }), "unit:5");
  assert.equal(
    buildSheetKey({ kind: "by-day-pxk", recipientUnitId: 5, periodDate: "2026-09-07" }),
    "unit:5|day:2026-09-07",
  );
  assert.equal(buildSheetKey({ kind: "by-day-bkmh", periodDate: "2026-09-07" }), "day:2026-09-07");
  assert.equal(buildSheetKey({ kind: "slip", issueSlipId: 99 }), "slip:99");
  assert.equal(buildSheetKey({ kind: "bkmh-slice", bkmhSliceId: 42 }), "bkmhSlice:42");
});
