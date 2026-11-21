import assert from "node:assert/strict";
import test from "node:test";
import { imeEnterAction } from "./imeEnterSubmit.js";

test("Vietnamese Telex/VNI composition does not submit", () => {
  const telexConfirm = { key: "Enter", isComposing: true, keyCode: 229, shiftKey: false };
  const vniConfirm = { key: "Enter", isComposing: true, keyCode: 229, shiftKey: false };
  assert.equal(imeEnterAction(telexConfirm, { shiftInsertsNewline: true }), "compose");
  assert.equal(imeEnterAction(vniConfirm), "compose");
});

test("Safari confirming Enter still does not submit when isComposing already flipped", () => {
  const safari = { key: "Enter", isComposing: false, keyCode: 229, shiftKey: false };
  assert.equal(imeEnterAction(safari, { shiftInsertsNewline: true }), "compose");
  assert.equal(imeEnterAction(safari), "compose");
});

test("plain Enter submits and Shift+Enter stays a newline only on a textarea", () => {
  const enter = { key: "Enter", isComposing: false, keyCode: 13, shiftKey: false };
  const shiftEnter = { key: "Enter", isComposing: false, keyCode: 13, shiftKey: true };
  assert.equal(imeEnterAction(enter, { shiftInsertsNewline: true }), "submit");
  assert.equal(imeEnterAction(shiftEnter, { shiftInsertsNewline: true }), "ignore");
  assert.equal(imeEnterAction(shiftEnter), "submit");
  assert.equal(imeEnterAction({ key: "a", keyCode: 65 }), "ignore");
});
