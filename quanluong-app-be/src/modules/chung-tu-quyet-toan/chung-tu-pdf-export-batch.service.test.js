import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const prismaTemplateFindFirst = mock.fn(async () => null);
const prismaBatchCreate = mock.fn(async ({ data, include }) => {
  const now = new Date("2026-08-23T05:00:00.000Z");
  const exports = (data.exports?.create ?? []).map((item, index) => ({
    id: index + 1,
    createdAt: now,
    updatedAt: now,
    ...item,
  }));
  return {
    id: 91,
    createdAt: now,
    updatedAt: now,
    ...data,
    exports: include?.exports ? exports : undefined,
  };
});
const prismaBatchFindMany = mock.fn(async () => []);
const prismaBatchFindUnique = mock.fn(async () => null);
const prismaBatchDelete = mock.fn(async () => ({}));
const prismaSignatureSettingsFindUnique = mock.fn(async () => null);

const resolveChungTuContext = mock.fn(async () => ({
  context: {
    periodMonth: "2026-06",
    sheetContexts: [
      {
        periodDate: "2026-06-01",
        donVi: "Kho A",
        tongTien: "1.000",
        detailRows: [{ stt: 1, tenHang: "Gạo" }],
      },
      {
        periodDate: "2026-06-02",
        donVi: "Kho A",
        tongTien: "0",
        detailRows: [],
      },
      {
        periodDate: "2026-06-03",
        donVi: "Kho A",
        tongTien: "1.000",
        detailRows: [{ stt: 1, tenHang: "Muối" }],
      },
    ],
    detailRows: [{ stt: 1, tenHang: "Gạo" }, { stt: 2, tenHang: "Muối" }],
    tongTien: "2.000",
    donVi: "Kho A",
  },
  sourceDataHash: "batch-hash-123",
}));
const getTemplateFields = mock.fn(async () => ({
  fields: [{ field_name: "don_vi", cell_ref: "B2" }, { field_name: "tong_tien", cell_ref: "B3" }],
  columns: [{ key: "stt", title: "STT" }, { key: "ten_mat_hang", title: "Tên mặt hàng" }],
}));
const createDocumentFolder = mock.fn(async () => ({
  id: 700,
  name: "ctpdf_batch_20260823_abcdef123456",
  created_at: "2026-08-23T05:00:00.000Z",
}));
const renderToDocumentFolder = mock.fn(async (_folderId, body) => ({
  file_id: renderToDocumentFolder.mock.callCount() + 10,
  file_name: body.fileName,
}));
const deleteDocumentFolder = mock.fn(async () => ({}));

mock.module("../../infra/database/prisma/prisma.client.js", {
  exports: {
    prisma: {
      chungTuPdfTemplate: {
        findFirst: prismaTemplateFindFirst,
      },
      chungTuPdfExportBatch: {
        create: prismaBatchCreate,
        findMany: prismaBatchFindMany,
        findUnique: prismaBatchFindUnique,
        delete: prismaBatchDelete,
      },
      chungTuSignatureSettings: {
        findUnique: prismaSignatureSettingsFindUnique,
        upsert: mock.fn(),
      },
    },
  },
});

mock.module("./chung-tu-data-resolver.service.js", {
  exports: {
    resolveChungTuContext,
  },
});

mock.module("../../services/document-service.client.js", {
  exports: {
    createDocumentFolder,
    deleteDocumentFolder,
    getDocumentFolder: mock.fn(),
    getTemplateFields,
    renderDocumentPdf: mock.fn(),
    renderToDocumentFolder,
    streamDocumentFolderFile: mock.fn(),
    streamDocumentFolderMergedPdf: mock.fn(),
    streamDocumentFolderZip: mock.fn(),
  },
});

const { pickExportSlices } = await import("./chung-tu-pdf-batch-slices.util.js");
const { createChungTuPdfExportBatch } = await import("./chung-tu-pdf-export-batch.service.js");

test.beforeEach(() => {
  prismaTemplateFindFirst.mock.resetCalls();
  prismaBatchCreate.mock.resetCalls();
  prismaBatchFindMany.mock.resetCalls();
  prismaBatchFindUnique.mock.resetCalls();
  prismaBatchDelete.mock.resetCalls();
  prismaSignatureSettingsFindUnique.mock.resetCalls();
  resolveChungTuContext.mock.resetCalls();
  getTemplateFields.mock.resetCalls();
  createDocumentFolder.mock.resetCalls();
  renderToDocumentFolder.mock.resetCalls();
  deleteDocumentFolder.mock.resetCalls();
});

test("pickExportSlices by-day skips empty contexts", () => {
  const slices = pickExportSlices({
    aggregationMode: "by-day",
    context: {
      sheetContexts: [
        { periodDate: "2026-06-01", detailRows: [{ tenHang: "A" }] },
        { periodDate: "2026-06-02", detailRows: [] },
        { periodDate: "2026-06-03", detailRows: [{ tenHang: "B" }] },
      ],
    },
  });

  assert.equal(slices.length, 2);
  assert.deepEqual(
    slices.map((item) => ({ fileName: item.fileName, sortKey: item.sortKey })),
    [
      { fileName: "2026-06-01.pdf", sortKey: "2026-06-01" },
      { fileName: "2026-06-03.pdf", sortKey: "2026-06-03" },
    ],
  );
});

test("pickExportSlices by-unit sanitizes and de-duplicates unit names", () => {
  const slices = pickExportSlices({
    aggregationMode: "by-unit",
    context: {
      sheetContexts: [
        { recipientUnitName: 'Bếp / A', detailRows: [{ tenHang: "A" }] },
        { recipientUnitName: 'Bếp / A', detailRows: [{ tenHang: "B" }] },
      ],
    },
  });

  assert.deepEqual(
    slices.map((item) => item.fileName),
    ["Bếp - A.pdf", "Bếp - A-2.pdf"],
  );
});

test("createChungTuPdfExportBatch creates a folder batch with one file per non-empty slice", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 15,
    categoryKey: "bang-ke-mua-hang",
    displayName: "BKMH A",
    documentServiceTemplateId: 901,
    isActive: true,
  }));
  prismaSignatureSettingsFindUnique.mock.mockImplementation(async () => ({
    id: 5,
    categoryKey: "bang-ke-mua-hang",
    signatureBlockJson: { columns: 2, slots: [{ key: "ke_toan", label: "Kế toán" }] },
    updatedById: 88,
    createdAt: new Date("2026-08-22T00:00:00.000Z"),
    updatedAt: new Date("2026-08-22T00:00:00.000Z"),
  }));

  const randomValues = ["abcdef123456", "111111111111", "222222222222"];
  const randomBytesMock = mock.method(crypto, "randomBytes", () =>
    Buffer.from(randomValues.shift() ?? "333333333333", "hex"),
  );
  try {
    const result = await createChungTuPdfExportBatch({
      categoryKey: "bang-ke-mua-hang",
      unitId: 9,
      periodMonth: "2026-06",
      unitIds: [10, 11],
      aggregationMode: "by-day",
      pdfTemplateId: 15,
      signatures: { ke_toan: "Nguyễn A" },
      signatureDates: { ke_toan: "Ngày 03 tháng 06 năm 2026" },
      settings: { ghiChu: "ghi chu" },
      createdById: 88,
      effectiveUnitIds: [9, 10, 11],
    });

    assert.equal(createDocumentFolder.mock.callCount(), 1);
    assert.equal(renderToDocumentFolder.mock.callCount(), 2);
    assert.deepEqual(
      renderToDocumentFolder.mock.calls.map((call) => call.arguments[1].fileName),
      ["2026-06-01.pdf", "2026-06-03.pdf"],
    );
    assert.deepEqual(renderToDocumentFolder.mock.calls[0].arguments, [
      700,
      {
        templateId: 901,
        fileName: "2026-06-01.pdf",
        sortKey: "2026-06-01",
        fields: { don_vi: "Kho A", tong_tien: "1.000" },
        rows: [{ stt: "1", ten_mat_hang: "Gạo" }],
        signatures: { ke_toan: "Nguyễn A" },
        signatureDates: { ke_toan: "Ngày 03 tháng 06 năm 2026" },
        signatureBlock: { columns: 2, slots: [{ key: "ke_toan", label: "Kế toán" }] },
      },
    ]);

    assert.equal(prismaBatchCreate.mock.callCount(), 1);
    const createdPayload = prismaBatchCreate.mock.calls[0].arguments[0].data;
    assert.match(createdPayload.batchKey, /^ctpdf_batch_\d+_abcdef123456$/);
    assert.equal(createdPayload.fileCount, 2);
    assert.equal(createdPayload.documentServiceFolderId, 700);
    assert.equal(createdPayload.documentServiceTemplateId, 901);
    assert.equal(createdPayload.categoryKey, "bang-ke-mua-hang");
    assert.deepEqual(createdPayload.unitIdsJson, [10, 11]);
    assert.deepEqual(createdPayload.signaturesJson, {
      signatures: { ke_toan: "Nguyễn A" },
      signatureDates: { ke_toan: "Ngày 03 tháng 06 năm 2026" },
      signatureBlock: { columns: 2, slots: [{ key: "ke_toan", label: "Kế toán" }] },
    });
    assert.equal(createdPayload.exports.create.length, 2);
    assert.equal(createdPayload.exports.create[0].documentServiceFileId, 10);
    assert.equal(createdPayload.exports.create[1].documentServiceFileId, 11);

    assert.equal(result.fileCount, 2);
    assert.equal(result.folderId, 700);
    assert.equal(result.files.length, 2);
    assert.equal(result.files[0].fileName, "2026-06-01.pdf");
    assert.equal(
      result.files[0].downloadPath,
      `/chungtuquyettoan/pdf-export-batches/${result.batchKey}/files/10`,
    );
  } finally {
    randomBytesMock.mock.restore();
  }
});
