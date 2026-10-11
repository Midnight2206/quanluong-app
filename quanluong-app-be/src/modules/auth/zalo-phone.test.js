import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVnPhone } from "./zalo-phone.js";

test("normalizeVnPhone gộp 0, +84 và 84", () => {
  assert.equal(normalizeVnPhone("0987654321"), "84987654321");
  assert.equal(normalizeVnPhone("+84 987 654 321"), "84987654321");
  assert.equal(normalizeVnPhone("84987654321"), "84987654321");
});

test("normalizeVnPhone trả null khi không phải số Việt Nam", () => {
  assert.equal(normalizeVnPhone(""), null);
  assert.equal(normalizeVnPhone("12345"), null);
});
