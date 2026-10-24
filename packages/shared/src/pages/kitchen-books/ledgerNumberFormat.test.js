import assert from "node:assert/strict";
import test from "node:test";
import { formatLedgerInput, formatLedgerNumber, parseViNumber } from "./ledgerNumberFormat.js";

test("định dạng sổ giữ đủ phần thập phân và ngăn nghìn", () => {
  assert.equal(formatLedgerNumber("11.9"), "11,9");
  assert.equal(formatLedgerNumber("72.97"), "72,97");
  assert.equal(formatLedgerNumber("215160"), "215.160");
  assert.equal(formatLedgerNumber("1167520"), "1.167.520");
  assert.equal(formatLedgerNumber("0"), "");
  assert.equal(formatLedgerNumber("0.0"), "");
  assert.equal(formatLedgerNumber("-0.3"), "-0,3");
  assert.equal(formatLedgerNumber("0", { blankZero: false }), "0");
});

test("đọc số người dùng gõ", () => {
  assert.equal(parseViNumber("11,9"), 11.9);
  assert.equal(parseViNumber("1.167.520"), 1167520);
  assert.equal(parseViNumber("11.9"), 11.9);
  assert.equal(parseViNumber("0,7"), 0.7);
  assert.equal(parseViNumber(""), null);
  assert.equal(parseViNumber("–"), null);
  assert.equal(parseViNumber("16.000"), 16000);
  assert.equal(formatLedgerInput("16000"), "16000");
  assert.equal(formatLedgerInput("11.9"), "11,9");
});
