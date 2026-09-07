import test from "node:test";
import assert from "node:assert/strict";

import { formatLyDoXuatKho } from "./chung-tu-pxk-ly-do.util.js";

test("formatLyDoXuatKho by-unit pads month and year", () => {
  assert.equal(
    formatLyDoXuatKho({ aggregationMode: "by-unit", periodMonth: "2026-06" }),
    "Cấp tiếp phẩm tháng 06 năm 2026",
  );
});

test("formatLyDoXuatKho by-day pads day and month", () => {
  assert.equal(
    formatLyDoXuatKho({ aggregationMode: "by-day", periodDate: "2026-06-05" }),
    "Cấp tiếp phẩm ngày 05 tháng 06 năm 2026",
  );
});
