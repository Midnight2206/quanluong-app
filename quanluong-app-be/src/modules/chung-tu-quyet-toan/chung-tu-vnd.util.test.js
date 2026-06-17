import test from "node:test";
import assert from "node:assert/strict";

import { vndToVietnameseDocumentLine } from "./chung-tu-vnd.util.js";

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
