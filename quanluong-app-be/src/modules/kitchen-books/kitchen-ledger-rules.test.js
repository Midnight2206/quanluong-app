import assert from "node:assert/strict";
import test from "node:test";
import { LEDGER_PRINT_LAYOUT } from "./kitchen-ledger-layout.js";
import {
  assertIssueSlipDepth,
  assertLedgerAction,
  assertLineIdentity,
  assertManualColumn,
  lockAfterSync,
  pdfStale,
  rejectReverseSlipWrite,
} from "./kitchen-ledger-rules.js";

test("cột Trên BĐ chỉ mở cho gạo", () => {
  assert.equal(assertManualColumn({ name: "Thịt vai", measureUnit: "Kg", source: "G", settings: {} }).statusCode, 403);
  assert.equal(assertManualColumn({ name: "Gạo tẻ", measureUnit: "Kg", source: "H", settings: {} }).ok, true);
  assert.equal(assertManualColumn({ name: "Thịt vai", measureUnit: "Kg", source: "I", settings: {} }).ok, true);
});

test("thiếu nguồn hoặc phẩm cấp thì không lưu", () => {
  assert.equal(assertLineIdentity({ sourceKind: "market", grade: "" }).statusCode, 400);
  assert.equal(assertLineIdentity({ sourceKind: "", grade: "loại 1" }).statusCode, 400);
  assert.equal(assertLineIdentity({ sourceKind: "tgsx", grade: "loại 1" }).ok, true);
});

test("quyền xem không ghi sổ, mở khóa cần quyền riêng", () => {
  const viewOnly = { permissions: ["kitchenBooks.view"] };
  assert.equal(assertLedgerAction(viewOnly, "save").statusCode, 403);
  assert.equal(assertLedgerAction(viewOnly, "unlock").statusCode, 403);
  assert.equal(assertLedgerAction({ permissions: ["kitchenBooks.save"] }, "save").ok, true);
  assert.equal(assertLedgerAction({ isSuperadmin: true }, "unlock").ok, true);
});

test("cấp 2 không lập phiếu xuất", () => {
  assert.equal(assertIssueSlipDepth(1).statusCode, 403);
  assert.equal(assertIssueSlipDepth(0).ok, true);
});

test("đồng bộ phiếu: ngày âm về nháp, ngày không âm giữ chốt", () => {
  const negative = lockAfterSync({ wasLocked: true, negatives: [{ name: "Mực" }] });
  assert.equal(negative.status, "draft");
  assert.equal(negative.reverted, true);
  const kept = lockAfterSync({ wasLocked: true, negatives: [] });
  assert.equal(kept.status, "locked");
  assert.equal(kept.needsResignature, true);
  assert.equal(lockAfterSync({ wasLocked: false, negatives: [{ name: "Mực" }] }).reverted, false);
});

test("PDF lỗi thời khi vân phiếu đổi sau lần xuất", () => {
  assert.equal(pdfStale({ pdfFingerprint: "", fingerprint: "a" }), false);
  assert.equal(pdfStale({ pdfFingerprint: "a", fingerprint: "a" }), false);
  assert.equal(pdfStale({ pdfFingerprint: "a", fingerprint: "b" }), true);
});

test("không ghi cân đối ngược vào phiếu", () => {
  const gone = rejectReverseSlipWrite();
  assert.equal(gone.statusCode, 410);
  assert.match(gone.message, /phiếu xuất/);
});

test("khung in màn hình và PDF là một bản", async () => {
  const shared = await import("../../../../packages/shared/src/pages/kitchen-books/ledgerPageLayout.js");
  assert.deepEqual(shared.LEDGER_PRINT_LAYOUT, LEDGER_PRINT_LAYOUT);
});
