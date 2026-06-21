import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCanCuBkmhLine,
  formatCanCuBkmhText,
} from "./chung-tu-pnk-bkmh-basis.service.js";

test("formatCanCuBkmhLine builds Vietnamese basis text", () => {
  const line = formatCanCuBkmhLine({
    soChungTu: "062515",
    nguoiMua: "Nguyễn Văn A",
    ngay: "15",
    thang: "06",
    nam: "2026",
  });
  assert.equal(line, "Theo BKMH số: 062515 của đ/c Nguyễn Văn A ngày 15 tháng 06 năm 2026");
});

test("formatCanCuBkmhText joins unique lines", () => {
  const text = formatCanCuBkmhText([
    {
      soChungTu: "062515",
      nguoiMua: "A",
      ngay: "15",
      thang: "06",
      nam: "2026",
    },
    {
      soChungTu: "062515",
      nguoiMua: "B",
      ngay: "15",
      thang: "06",
      nam: "2026",
    },
  ]);
  assert.match(text, /062515.*A/);
  assert.match(text, /062515.*B/);
  assert.ok(text.includes("; "));
});
