import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCanCuPnkLine,
  formatCanCuPnkText,
} from "./chung-tu-pnk-bkmh-basis.service.js";

test("formatCanCuPnkLine builds Vietnamese basis text", () => {
  const line = formatCanCuPnkLine({
    soChungTu: "062515",
    buyerName: "Nguyễn Văn A",
    ngay: "15",
    thang: "06",
    nam: "2026",
  });
  assert.equal(line, "Căn cứ vào BKMH số 062515 ngày 15 tháng 06 năm 2026 của đ/c Nguyễn Văn A");
});

test("formatCanCuPnkText joins unique lines", () => {
  const text = formatCanCuPnkText([
    {
      soChungTu: "062515",
      buyerName: "A",
      ngay: "15",
      thang: "06",
      nam: "2026",
    },
    {
      soChungTu: "062515",
      buyerName: "B",
      ngay: "15",
      thang: "06",
      nam: "2026",
    },
  ]);
  assert.match(text, /062515.*A/);
  assert.match(text, /062515.*B/);
  assert.ok(text.includes(", "));
});
