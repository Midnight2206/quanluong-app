import test from "node:test";
import assert from "node:assert/strict";

import {
  formatViNumber,
  formatVndNumber,
  sanitizeDecimal,
  vndToVietnameseDocumentLine,
} from "./chung-tu-vnd.util.js";

test("vndToVietnameseDocumentLine reads three-digit groups without undefined", () => {
  const text = vndToVietnameseDocumentLine(103_324_000);
  assert.equal(text.includes("undefined"), false);
  assert.equal(text, "Một trăm linh ba triệu ba trăm hai mươi bốn nghìn đồng");
});

test("vndToVietnameseDocumentLine reads zero-padded lower groups", () => {
  const text = vndToVietnameseDocumentLine(1_024_000);
  assert.equal(text.includes("undefined"), false);
  assert.equal(text, "Một triệu không trăm hai mươi bốn nghìn đồng");
});

test("sanitizeDecimal strips IEEE-754 noise", () => {
  assert.equal(sanitizeDecimal(0.1 + 0.2), 0.3);
  assert.equal(sanitizeDecimal(0.1999999999999998), 0.2);
  assert.equal(sanitizeDecimal(null), null);
  assert.equal(String(sanitizeDecimal(0.1 + 0.2)), "0.3");
});

test("formatViNumber uses dot thousands and comma decimals", () => {
  assert.equal(formatViNumber(3100), "3.100");
  assert.equal(formatViNumber(3_110_100), "3.110.100");
  assert.equal(formatViNumber(32_445_000), "32.445.000");
  assert.equal(formatViNumber(3.2), "3,2");
  assert.equal(formatViNumber(0.25), "0,25");
  assert.equal(formatViNumber(0.1 + 0.2), "0,3");
  assert.equal(formatViNumber(Number.NaN), "");
});

test("formatVndNumber rounds money and groups with dots", () => {
  assert.equal(formatVndNumber(1234567), "1.234.567");
  assert.equal(formatVndNumber(95_000.4), "95.000");
});
