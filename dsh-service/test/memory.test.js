import assert from "node:assert/strict";
import test from "node:test";
import { requireActor } from "../src/actor.js";
import { emptyBook } from "../src/json-doc.js";
import {
  forgetMemory,
  remember,
  searchMemory,
  summarizeMemory,
} from "../plugins/quanluong-memory/logic.js";

const unitA = { unitId: "unit-a", accountId: "user-1" };
const otherUser = { unitId: "unit-a", accountId: "user-2" };
const unitB = { unitId: "unit-b", accountId: "user-1" };

test("memory stays inside the unit and the user partition", () => {
  let doc = emptyBook();
  doc = remember(doc, unitA, { text: "Bep an dung gao", scope: "unit", id: "m1" }).doc;
  doc = remember(doc, unitA, { text: "User 1 thich ngan gon", scope: "user", id: "m2" }).doc;
  doc = remember(doc, unitB, { text: "Bi mat don vi B", scope: "unit", id: "m3" }).doc;
  assert.deepEqual(searchMemory(doc, unitA, "gao").map((item) => item.id), ["m1"]);
  assert.deepEqual(searchMemory(doc, otherUser, "ngan").map((item) => item.id), []);
  assert.deepEqual(searchMemory(doc, otherUser, "gao").map((item) => item.id), ["m1"]);
  assert.deepEqual(searchMemory(doc, unitB, "gao").map((item) => item.id), []);
  assert.equal(searchMemory(doc, unitA, "Bi mat").length, 0);
  const summary = summarizeMemory(doc, unitA, "unit");
  assert.equal(summary.text, "Bep an dung gao");
  assert.equal(summary.persisted, false);
  assert.throws(() => forgetMemory(doc, otherUser, "m2"), /not found/i);
});

test("secrets are redacted and a full store is not trimmed by the model", () => {
  const stored = remember(emptyBook(), unitA, {
    text: "key sk-abcdefghijklmnopqrstuvwxyz MENU_AI_API_KEY=super-secret",
    scope: "unit",
  });
  assert.equal(stored.entry.text.includes("super-secret"), false);
  assert.match(stored.entry.text, /\[redacted\]/);
  let fullDoc = emptyBook();
  fullDoc = remember(fullDoc, unitA, { text: "x".repeat(800), scope: "unit", id: "f1" }).doc;
  fullDoc = remember(fullDoc, unitA, { text: "x".repeat(800), scope: "unit", id: "f2" }).doc;
  assert.throws(() => remember(fullDoc, unitA, { text: "x".repeat(800), scope: "unit" }), /full/i);
  assert.equal(fullDoc.units["unit-a"].entries.length, 2);
  const userNote = remember(fullDoc, unitA, { text: "ghi chu ca nhan", scope: "user" });
  assert.equal(userNote.entry.scope, "user");
});

test("a tool cannot claim another unit", () => {
  assert.throws(() => requireActor(unitA, { unitId: "unit-b" }), /mismatch/i);
  assert.equal(requireActor(unitA, {}).unitId, "unit-a");
});
