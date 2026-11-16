import assert from "node:assert/strict";
import test from "node:test";
import { currentMonthYmd, monthBoundsYmd } from "./monthBoundsYmd.js";

test("monthBoundsYmd covers full calendar month", () => {
  assert.deepEqual(monthBoundsYmd("2026-02"), {
    month: "2026-02",
    from: "2026-02-01",
    to: "2026-02-28",
  });
  assert.deepEqual(monthBoundsYmd("2024-02"), {
    month: "2024-02",
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.match(currentMonthYmd(), /^\d{4}-\d{2}$/);
});
