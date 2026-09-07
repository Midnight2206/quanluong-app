import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBkmhBuyerKey,
  buildBkmhBuyerSnapshotFromPerson,
} from "./chung-tu-bkmh-buyer-snapshot.util.js";

test("buildBkmhBuyerKey prefers user id", () => {
  assert.equal(buildBkmhBuyerKey({ buyerUserId: 7, buyerName: "A" }), "user:7");
});

test("buildBkmhBuyerKey falls back to normalized name", () => {
  assert.equal(
    buildBkmhBuyerKey({ buyerUserId: null, buyerName: "  Nguyễn Văn A " }),
    "name:nguyen van a",
  );
});

test("buildBkmhBuyerSnapshotFromPerson maps catalog person", () => {
  const snap = buildBkmhBuyerSnapshotFromPerson(
    { name: "Nguyễn Văn A", signatureName: "Th/tá Nguyễn Văn A", title: "Tài vụ" },
    7,
  );
  assert.equal(snap.buyerUserId, 7);
  assert.equal(snap.buyerKey, "user:7");
  assert.equal(snap.buyerName, "Nguyễn Văn A");
  assert.equal(snap.buyerSignatureName, "Th/tá Nguyễn Văn A");
  assert.equal(snap.buyerTitle, "Tài vụ");
});

test("buildBkmhBuyerSnapshotFromPerson empty person returns empty key fields", () => {
  const snap = buildBkmhBuyerSnapshotFromPerson(null, null);
  assert.equal(snap.buyerKey, "");
  assert.equal(snap.buyerName, "");
});
