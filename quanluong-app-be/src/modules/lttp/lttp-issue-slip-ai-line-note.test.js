import assert from "node:assert/strict";
import test from "node:test";
import { lineNoteForItem, parseSumExpression, quantityTokenForConvert, takeLastParen } from "./lttp-issue-slip-ai-line-note.js";

test("addition keeps the expression and sums the parts", () => {
  assert.deepEqual(parseSumExpression("4 + 6"), { expression: "4+6", sum: 10 });
  assert.equal(quantityTokenForConvert("4+6+2"), "12");
  assert.equal(lineNoteForItem({ writtenQty: "4+6", writtenUom: "quả", parenText: "loại 1", stockUom: "kg", originalQtyOnConvert: true }).lineNote, "4+6");
  assert.equal(lineNoteForItem({ writtenQty: "4+6+2", writtenUom: "kg", parenText: "", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "4+6+2");
  assert.equal(parseSumExpression("4*6"), null);
  assert.equal(lineNoteForItem({ writtenQty: "4*6", writtenUom: "kg", parenText: "", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "");
});

test("parentheses fill the note only when there is no addition", () => {
  assert.deepEqual(takeLastParen("chuối (30 quả)"), { name: "chuối", parenText: "30 quả" });
  assert.equal(lineNoteForItem({ writtenQty: "3", writtenUom: "kg", parenText: "30 quả", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "30 quả");
  assert.equal(lineNoteForItem({ writtenQty: "3", writtenUom: "kg", parenText: "   ", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "");
});

test("conversion note waits for the shared rule and loses to an addition", () => {
  assert.equal(lineNoteForItem({ writtenQty: "30", writtenUom: "quả", parenText: "", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "");
  assert.equal(lineNoteForItem({ writtenQty: "30", writtenUom: "quả", parenText: "", stockUom: "kg", originalQtyOnConvert: true }).lineNote, "30 quả");
  assert.equal(lineNoteForItem({ writtenQty: "30", writtenUom: "qua", parenText: "", stockUom: "quả", originalQtyOnConvert: true }).lineNote, "");
  assert.equal(lineNoteForItem({ writtenQty: "30", writtenUom: "kg", parenText: "", stockUom: "kg", originalQtyOnConvert: true }).lineNote, "");
  assert.equal(lineNoteForItem({ writtenQty: "4+6", writtenUom: "quả", parenText: "", stockUom: "kg", originalQtyOnConvert: true }).lineNote, "4+6");
});
