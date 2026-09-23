import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getDefaultLttpIssueSlipSignatureBlock,
  normalizeLttpIssueSlipExtraFields,
  normalizeLttpIssueSlipSignatureBlock,
  LTTP_ISSUE_SLIP_SIGNATURE_SLOT_KEYS,
} from "./lttp-issue-slip-signature-defaults.js";

test("default LTTP signature block has 4 slots", () => {
  const block = getDefaultLttpIssueSlipSignatureBlock();
  assert.equal(block.columns, 4);
  assert.deepEqual(
    block.slots.map((s) => s.key),
    [...LTTP_ISSUE_SLIP_SIGNATURE_SLOT_KEYS],
  );
  assert.equal(block.slots.find((s) => s.key === "nguoi_viet_phieu")?.locked, true);
  assert.equal(block.slots.find((s) => s.key === "nguoi_nhan")?.locked, true);
  assert.equal(block.slots.find((s) => s.key === "thu_kho")?.locked, false);
});

test("normalize extra fields trims lyDoSuDung and nhanTaiKho", () => {
  assert.deepEqual(
    normalizeLttpIssueSlipExtraFields({ lyDoSuDung: "  x  ", nhanTaiKho: " kho " }),
    { lyDoSuDung: "x", nhanTaiKho: "kho" },
  );
  assert.deepEqual(normalizeLttpIssueSlipExtraFields(null), {
    lyDoSuDung: "",
    nhanTaiKho: "",
  });
});

test("normalize signature block falls back to default when empty", () => {
  const block = normalizeLttpIssueSlipSignatureBlock({});
  assert.equal(block.slots.length, 4);
  assert.equal(block.slots[1].key, "thu_kho");
});

test("normalize forces locked dynamic slots for writer and recipient", () => {
  const block = normalizeLttpIssueSlipSignatureBlock({
    slots: [
      {
        key: "nguoi_viet_phieu",
        source: "static",
        static_name: "X",
        locked: false,
      },
      { key: "thu_kho", source: "static", static_name: "Kho" },
      { key: "nguoi_nhan", source: "static", static_name: "Y", locked: false },
      { key: "nguoi_duyet", source: "dynamic" },
    ],
  });
  const writer = block.slots.find((s) => s.key === "nguoi_viet_phieu");
  const recipient = block.slots.find((s) => s.key === "nguoi_nhan");
  assert.equal(writer.locked, true);
  assert.equal(writer.source, "dynamic");
  assert.equal(writer.static_name, "");
  assert.equal(recipient.locked, true);
  assert.equal(recipient.source, "dynamic");
  assert.equal(recipient.static_name, "");
});

test("normalize lifts legacy tiny gap_pt to CTQT signing space", () => {
  assert.equal(getDefaultLttpIssueSlipSignatureBlock().gap_pt, 40);
  assert.equal(normalizeLttpIssueSlipSignatureBlock({ gap_pt: 8, slots: [] }).gap_pt, 40);
  assert.equal(normalizeLttpIssueSlipSignatureBlock({ gap_pt: 40, slots: [] }).gap_pt, 40);
  assert.equal(normalizeLttpIssueSlipSignatureBlock({ gap_pt: 56, slots: [] }).gap_pt, 56);
});

test("normalize: linked nguoi_duyet forces source dynamic (user-resolved)", () => {
  const block = normalizeLttpIssueSlipSignatureBlock({
    slots: [
      { key: "nguoi_viet_phieu", source: "dynamic", locked: true },
      { key: "thu_kho", source: "static", static_name: "Kho" },
      { key: "nguoi_nhan", source: "dynamic", locked: true },
      {
        key: "nguoi_duyet",
        source: "static",
        static_name: "1// stale",
        approverUserId: 4,
        useDigitalSignature: true,
      },
    ],
  });
  const duyet = block.slots.find((s) => s.key === "nguoi_duyet");
  assert.equal(duyet.source, "dynamic");
  assert.equal(duyet.approverUserId, 4);
  assert.equal(duyet.static_name, "1// stale"); // preview kept; PDF ignores when dynamic
});

test("normalize: unlinked nguoi_duyet may stay static", () => {
  const block = normalizeLttpIssueSlipSignatureBlock({
    slots: [
      { key: "nguoi_viet_phieu", locked: true },
      { key: "thu_kho", source: "static", static_name: "Kho" },
      { key: "nguoi_nhan", locked: true },
      { key: "nguoi_duyet", source: "static", static_name: "Trung tá A" },
    ],
  });
  const duyet = block.slots.find((s) => s.key === "nguoi_duyet");
  assert.equal(duyet.source, "static");
  assert.equal(duyet.approverUserId, null);
  assert.equal(duyet.static_name, "Trung tá A");
});
