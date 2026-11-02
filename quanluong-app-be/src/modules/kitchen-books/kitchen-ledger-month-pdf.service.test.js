import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../errors/app-error.js";

process.env.DATABASE_URL ||= "mysql://local:local@127.0.0.1:3306/quanluong";
process.env.JWT_ACCESS_SECRET ||= "test-secret-test-secret-test-secret";
process.env.SESSION_SECRET ||= "test-session-test-session-test-session";

const { exportLedgerMonthPdf } = await import("./kitchen-ledger-month-pdf.service.js");

function view(date, status) {
  return {
    date,
    status,
    ledgerBlocked: false,
    lines: [],
    totals: {},
    finance: null,
  };
}

test("xuất tháng 02/2026: nháp lên bìa, nhật ký EXPORT, không ghi PDF", async () => {
  const audits = [];
  let seen = null;
  const buffer = Buffer.from("%PDF-test");
  const result = await exportLedgerMonthPdf(
    { unitId: 3, month: "2026-02" },
    { id: 9, profile: { rankAbbr: "1//CN", fullName: "Người in" } },
    { mode: "all" },
    [],
    { storageUnitId: 3, logicalUnitId: 3 },
    {
      getLedger: async ({ date }) => view(date, date.endsWith("-01") ? "locked" : "draft"),
      getSignatureSettings: async () => ({
        signatureBlock: {
          slots: [{
            key: "nguoi_duyet",
            source: "dynamic",
            approverUserId: 4,
            useDigitalSignature: true,
            static_name: "",
          }],
        },
      }),
      resolveApproverName: async () => "Thượng tá Chỉ Huy",
      loadSignature: async (id) => (id === 9 ? "data:image/png;base64,QQ==" : null),
      render: async (book) => {
        seen = book;
        return buffer;
      },
      prisma: {
        unit: { findUnique: async () => ({ name: "Tiểu đoàn" }) },
        dataChangeLog: { create: async ({ data }) => { audits.push(data); } },
      },
      getAuditContext: () => ({ requestId: "req-1", route: "GET /api/kitchen-books/ledger/month-pdf", ip: "10.0.0.8", userId: 9 }),
    },
  );
  assert.equal(result.buffer, buffer);
  assert.equal(result.fileName, "So-nhap-xuat-LTTP-2026-02.pdf");
  assert.equal(seen.days.length, 28);
  assert.equal(seen.tail, null);
  assert.equal(seen.cover.draftDays.includes("2026-02-01"), false);
  assert.equal(seen.cover.draftDays.includes("2026-02-02"), true);
  assert.equal(seen.cover.commander, "Thượng tá Chỉ Huy");
  assert.equal(seen.signatures.quan_ly, "1//CN Người in");
  assert.equal(seen.signatures.truc_ban, "");
  assert.equal(seen.signatures.chi_huy, "Thượng tá Chỉ Huy");
  assert.equal(seen.signatureImages.quan_ly, "data:image/png;base64,QQ==");
  assert.equal(seen.signatureImages.chi_huy, undefined);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "EXPORT");
  assert.equal(audits[0].model, "KitchenLedgerMonth");
  assert.equal(audits[0].recordId, "3:2026-02");
  assert.equal(audits[0].changes.pageCount, 1 + 28 * 2);
  assert.equal(audits[0].changes.fileName, result.fileName);
  assert.equal("buffer" in audits[0].changes, false);
  assert.equal(audits[0].requestId, "req-1");
});

test("tắt chữ ký số thì chỉ huy lấy tên tĩnh, không lấy ảnh", async () => {
  let seen = null;
  await exportLedgerMonthPdf(
    { unitId: 3, month: "2026-02" },
    { id: 9, profile: { fullName: "Người in" } },
    {},
    [],
    {},
    {
      getLedger: async ({ date }) => view(date, "locked"),
      getSignatureSettings: async () => ({
        signatureBlock: {
          slots: [{
            key: "nguoi_duyet",
            source: "static",
            approverUserId: 4,
            useDigitalSignature: false,
            static_name: "Chỉ huy in sẵn",
          }],
        },
      }),
      resolveApproverName: async () => {
        throw new Error("không hỏi user khi tắt chữ ký số");
      },
      loadSignature: async (id) => (id === 4 ? "data:image/png;base64,QQ==" : null),
      render: async (book) => {
        seen = book;
        return Buffer.from("%PDF");
      },
      prisma: {
        unit: { findUnique: async () => ({ name: "Tiểu đoàn" }) },
        dataChangeLog: { create: async () => {} },
      },
    },
  );
  assert.equal(seen.signatures.chi_huy, "Chỉ huy in sẵn");
  assert.equal(seen.signatureImages.chi_huy, undefined);
  assert.equal(seen.cover.draftDays.length, 0);
});

test("lỗi phạm vi của một ngày không bị bọc, và không ghi nhật ký", async () => {
  const audits = [];
  await assert.rejects(
    () => exportLedgerMonthPdf(
      { unitId: 3, month: "2026-10" },
      { id: 1 },
      {},
      [],
      {},
      {
        getLedger: async () => {
          throw new AppError({ message: "Ngoài phạm vi đơn vị", statusCode: 403, code: "FORBIDDEN" });
        },
        getSignatureSettings: async () => ({}),
        render: async () => Buffer.from(""),
        prisma: { dataChangeLog: { create: async ({ data }) => { audits.push(data); } }, unit: { findUnique: async () => null } },
      },
    ),
    (error) => error instanceof AppError && error.statusCode === 403,
  );
  assert.equal(audits.length, 0);
});

test("tháng còn tồn âm thì không xuất PDF", async () => {
  await assert.rejects(
    () => exportLedgerMonthPdf(
      { unitId: 3, month: "2026-02" },
      { id: 1 },
      {},
      [],
      {},
      {
        getLedger: async ({ date }) => ({
          ...view(date, "draft"),
          lines: date.endsWith("-02") ? [{ name: "Mực", negative: true, closingQty: "-1", uom: "Kg" }] : [],
        }),
        getSignatureSettings: async () => ({}),
        prisma: { unit: { findUnique: async () => ({ name: "" }) }, dataChangeLog: { create: async () => {} } },
        render: async () => Buffer.from("%PDF"),
      },
    ),
    (error) => error instanceof AppError && error.statusCode === 409 && error.code === "negative_stock"
      && error.details.items.some((row) => row.name === "Mực" && row.date.endsWith("-02")),
  );
});

test("ngày nổ lỗi khác thì báo đúng ngày", async () => {
  await assert.rejects(
    () => exportLedgerMonthPdf(
      { unitId: 3, month: "2026-10" },
      { id: 1 },
      {},
      [],
      {},
      {
        getLedger: async ({ date }) => {
          if (date.endsWith("-03")) throw new Error("db");
          return view(date, "locked");
        },
        getSignatureSettings: async () => ({}),
        prisma: { unit: { findUnique: async () => ({ name: "" }) }, dataChangeLog: { create: async () => {} } },
        render: async () => Buffer.from(""),
      },
    ),
    (error) => error instanceof AppError && error.message.includes("2026-10-03"),
  );
});
