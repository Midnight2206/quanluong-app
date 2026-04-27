import assert from "node:assert/strict";
import test from "node:test";

import { formatIssueSlipPrintDate } from "./printIssueDate.js";

test("formats issue slip date with padded day and only pads January/February month", () => {
  assert.equal(formatIssueSlipPrintDate("2026-01-04"), "Ngày 04 tháng 01 năm 2026");
  assert.equal(formatIssueSlipPrintDate("2026-02-04"), "Ngày 04 tháng 02 năm 2026");
  assert.equal(formatIssueSlipPrintDate("2026-04-04"), "Ngày 04 tháng 4 năm 2026");
});
