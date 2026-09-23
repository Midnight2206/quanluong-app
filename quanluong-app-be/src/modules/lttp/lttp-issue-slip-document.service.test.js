import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const {
  buildLttpIssueSlipDocumentContext,
  mergeIssueSlipSignatures,
  LTTP_PHIEU_XUAT_CATEGORY_KEY,
} = await import("./lttp-issue-slip-document.service.js");

test("context maps writer profile, recipient department, settings extras, dates", () => {
  const ctx = buildLttpIssueSlipDocumentContext(
    {
      issueDate: "2026-09-15",
      receivedDate: "2026-09-16",
      bookMmyy: "0926",
      slipNo: 7,
      recipientDisplayName: "Nguyễn Văn A",
      recipientUser: { fullName: "Nguyễn Văn A", department: "Quân nhu" },
      signerWriter: "Viết",
      signerStorekeeper: "Kho",
      signerApprover: "Duyệt",
      lines: [],
    },
    {
      exportingUserProfile: { donViCapTren: "Sư đoàn", donVi: "Tiểu đoàn" },
      signatureSettings: {
        extraFields: { lyDoSuDung: "Cấp dưỡng", nhanTaiKho: "Kho tổng" },
      },
    },
  );
  assert.equal(ctx.categoryKey, LTTP_PHIEU_XUAT_CATEGORY_KEY);
  assert.equal(ctx.donViCapTren, "Sư đoàn");
  assert.equal(ctx.donVi, "Tiểu đoàn");
  assert.equal(ctx.boPhan, "Quân nhu");
  assert.equal(ctx.lyDoSuDung, "Cấp dưỡng");
  assert.equal(ctx.nhanTaiKho, "Kho tổng");
  assert.equal(ctx.quyenSo, "0926");
  assert.equal(ctx.soChungTu, "0007");
  assert.match(ctx.ngayGiao, /15 tháng 9 năm 2026/);
  assert.match(ctx.ngayNhan, /16 tháng 9 năm 2026/);
});

test("ngayNhan falls back to issueDate when receivedDate missing", () => {
  const ctx = buildLttpIssueSlipDocumentContext(
    { issueDate: "2026-10-01", slipNo: 1, lines: [] },
    { exportingUserProfile: {} },
  );
  assert.equal(ctx.ngayGiao, ctx.ngayNhan);
});

test("merge signatures: writer/recipient fixed; thu_kho/duyet slip>static", () => {
  const sig = mergeIssueSlipSignatures(
    {
      signerWriter: "A (ignored when profile present)",
      signerStorekeeper: "",
      signerRecipient: "R override ignored",
      signerApprover: "",
      recipientDisplayName: "Nguyễn Văn R",
    },
    {
      slots: [
        { key: "nguoi_viet_phieu", source: "static", static_name: "Static Writer" },
        { key: "thu_kho", source: "static", static_name: "Thủ kho ĐV" },
        { key: "nguoi_nhan", source: "static", static_name: "Static Recipient" },
        { key: "nguoi_duyet", source: "static", static_name: "Duyệt ĐV" },
      ],
    },
    { exportingUserProfile: { fullName: "Trần Văn Viết", rankAbbr: "Đ/c" } },
  );
  assert.equal(sig.nguoi_viet_phieu, "Đ/c Trần Văn Viết");
  assert.equal(sig.thu_kho, "Thủ kho ĐV");
  assert.equal(sig.nguoi_nhan, "Nguyễn Văn R");
  assert.equal(sig.nguoi_duyet, "Duyệt ĐV");
});

test("merge signatures: linked approver uses live rankFull only (dynamic)", () => {
  const sig = mergeIssueSlipSignatures(
    {
      signerApprover: "Th/tá Trần Khánh",
      recipientDisplayName: "R",
    },
    {
      slots: [
        {
          key: "nguoi_duyet",
          source: "dynamic",
          approverUserId: 4,
          static_name: "1// stale preview ignored when linked",
        },
      ],
    },
    {
      exportingUserProfile: { fullName: "Viết", rankAbbr: "Đ/c" },
      resolvedApproverName: "Thiếu tá Trần Khánh",
      approverLinked: true,
    },
  );
  assert.equal(sig.nguoi_duyet, "Thiếu tá Trần Khánh");
});

test("merge signatures: linked but empty live name does not fall back to abbr", () => {
  const sig = mergeIssueSlipSignatures(
    { signerApprover: "Th/tá X", recipientDisplayName: "R" },
    {
      slots: [
        { key: "nguoi_duyet", source: "dynamic", approverUserId: 9, static_name: "Th/tá X" },
      ],
    },
    { resolvedApproverName: "", approverLinked: true },
  );
  assert.equal(sig.nguoi_duyet, "");
});
