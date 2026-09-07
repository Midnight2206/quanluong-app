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
const prismaBatchUpdate = mock.fn(async ({ where, data, include }) => {
  const now = new Date("2026-09-07T05:00:00.000Z");
  const exports = (data.exports?.create ?? []).map((item, index) => ({
    id: index + 1,
    createdAt: now,
    updatedAt: now,
    ...item,
  }));
  return {
    id: where?.id ?? 91,
    createdAt: now,
    updatedAt: now,
    batchKey: "batch_reexport",
    categoryKey: data.categoryKey ?? "phieu-xuat-kho",
    unitId: 9,
    periodMonth: "2026-09",
    periodDate: null,
    issueSlipId: null,
    unitIdsJson: [10, 11],
    aggregationMode: "by-unit",
    documentServiceFolderId: 700,
    displayName: "PXK re-export",
    fileCount: exports.length,
    createdById: 88,
    ...data,
    exports: include?.exports ? exports : undefined,
  };
});
const prismaExportDeleteMany = mock.fn(async () => ({ count: 0 }));
const prismaSignatureSettingsFindUnique = mock.fn(async () => null);

const resolveChungTuContext = mock.fn(async () => ({
  context: {
    periodMonth: "2026-06",
    sheetContexts: [
      {
        soChungTu: "CT-0601",
        periodDate: "2026-06-01",
        donVi: "Kho A",
        recipientUnitName: "Đại đội 1",
        ngayThangNam: "Ngày 01 tháng 06 năm 2026",
        tongTien: "1.000",
        detailRows: [{ stt: 1, tenHang: "Gạo" }],
      },
      {
        soChungTu: "CT-0602",
        periodDate: "2026-06-02",
        donVi: "Kho A",
        recipientUnitName: "Đại đội 1",
        ngayThangNam: "Ngày 02 tháng 06 năm 2026",
        tongTien: "0",
        detailRows: [],
      },
      {
        soChungTu: "CT-0603",
        periodDate: "2026-06-03",
        donVi: "Kho A",
        recipientUnitName: "Đại đội 2",
        ngayThangNam: "Ngày 03 tháng 06 năm 2026",
        tongTien: "1.000",
        detailRows: [{ stt: 1, tenHang: "Muối" }],
      },
    ],
    detailRows: [{ stt: 1, tenHang: "Gạo" }, { stt: 2, tenHang: "Muối" }],
    soChungTu: "CT-THANG-06",
    tongTien: "2.000",
    donVi: "Kho A",
  },
  sourceDataHash: "batch-hash-123",
}));
const prepareSignatureBlockForRender = mock.fn(async (block) => block);
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
const clearDocumentFolderFiles = mock.fn(async () => ({}));
const attachDocNumbersToContexts = mock.fn(async ({ contexts }) => {
  for (const ctx of contexts ?? []) {
    ctx.sheetKey = ctx.sheetKey || `sheet:${ctx.recipientUnitId ?? ctx.periodDate ?? "x"}`;
    ctx.quyenSo = ctx.quyenSo || "0926";
    ctx.soChungTu = ctx.soChungTu || "0001";
    ctx.so = ctx.soChungTu;
    ctx.soPhieu = ctx.soChungTu;
  }
  return contexts;
});

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
        update: prismaBatchUpdate,
      },
      chungTuPdfExport: {
        deleteMany: prismaExportDeleteMany,
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
    prepareSignatureBlockForRender,
    attachDocNumbersToContexts,
  },
});

mock.module("../../services/document-service.client.js", {
  exports: {
    createDocumentFolder,
    clearDocumentFolderFiles,
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
const {
  createChungTuPdfExportBatch,
  getChungTuPdfExportBatch,
  reExportChungTuPdfExportBatch,
} = await import("./chung-tu-pdf-export-batch.service.js");

test.beforeEach(() => {
  prismaTemplateFindFirst.mock.resetCalls();
  prismaBatchCreate.mock.resetCalls();
  prismaBatchFindMany.mock.resetCalls();
  prismaBatchFindUnique.mock.resetCalls();
  prismaBatchDelete.mock.resetCalls();
  prismaBatchUpdate.mock.resetCalls();
  prismaExportDeleteMany.mock.resetCalls();
  prismaSignatureSettingsFindUnique.mock.resetCalls();
  resolveChungTuContext.mock.resetCalls();
  prepareSignatureBlockForRender.mock.resetCalls();
  attachDocNumbersToContexts.mock.resetCalls();
  getTemplateFields.mock.resetCalls();
  createDocumentFolder.mock.resetCalls();
  clearDocumentFolderFiles.mock.resetCalls();
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
    status: "published",
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
      exportingUserProfile: {
        donViCapTren: "Su doan 372",
        donVi: "Tieu doan 1",
      },
      signatures: { ke_toan: "Nguyễn A" },
      signatureDates: { ke_toan: "Ngày 03 tháng 06 năm 2026" },
      settings: { ghiChu: "ghi chu" },
      createdById: 88,
      effectiveUnitIds: [9, 10, 11],
    });

    assert.equal(prismaTemplateFindFirst.mock.callCount(), 1);
    assert.deepEqual(prismaTemplateFindFirst.mock.calls[0].arguments[0], {
      where: {
        id: 15,
        status: "published",
        categoryKey: "bang-ke-mua-hang",
      },
    });
    assert.deepEqual(resolveChungTuContext.mock.calls[0].arguments[0], {
      categoryKey: "bang-ke-mua-hang",
      unitId: 9,
      periodDate: undefined,
      periodMonth: "2026-06",
      issueSlipId: undefined,
      unitIds: [10, 11],
      aggregationMode: "by-day",
      exportingUserProfile: {
        donViCapTren: "Su doan 372",
        donVi: "Tieu doan 1",
      },
      settings: { ghiChu: "ghi chu" },
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
    assert.deepEqual(createdPayload.exports.create[0].summaryJson, {
      soChungTu: "CT-0601",
      periodDate: "2026-06-01",
      ngayThangNam: "Ngày 01 tháng 06 năm 2026",
      tongTien: 1000,
      recipientUnitName: "Đại đội 1",
    });
    assert.deepEqual(createdPayload.exports.create[1].summaryJson, {
      soChungTu: "CT-0603",
      periodDate: "2026-06-03",
      ngayThangNam: "Ngày 03 tháng 06 năm 2026",
      tongTien: 1000,
      recipientUnitName: "Đại đội 2",
    });

    assert.equal(result.fileCount, 2);
    assert.equal(result.folderId, 700);
    assert.equal(result.tongTienFolder, 2000);
    assert.equal(result.files.length, 2);
    assert.equal(result.files[0].fileName, "2026-06-01.pdf");
    assert.equal(result.files[0].soChungTu, "CT-0601");
    assert.equal(result.files[0].periodDate, "2026-06-01");
    assert.equal(result.files[0].ngayThangNam, "Ngày 01 tháng 06 năm 2026");
    assert.equal(result.files[0].tongTien, 1000);
    assert.equal(result.files[0].recipientUnitName, "Đại đội 1");
    assert.deepEqual(result.files[0].summary, createdPayload.exports.create[0].summaryJson);
    assert.equal(
      result.files[0].downloadPath,
      `/chungtuquyettoan/pdf-export-batches/${result.batchKey}/files/10`,
    );
  } finally {
    randomBytesMock.mock.restore();
  }
});

test("createChungTuPdfExportBatch forwards PXK extra fields and materializes nguoi_nhan slot", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 17,
    categoryKey: "phieu-xuat-kho",
    displayName: "PXK A",
    documentServiceTemplateId: 903,
    status: "published",
  }));
  resolveChungTuContext.mock.mockImplementationOnce(async () => ({
    context: {
      periodMonth: "2026-06",
      lyDoXuatKho: "Cap tiep pham thang 06 nam 2026",
      xuatTaiKho: "Kho trung tam",
      diaDiem: "Doanh trai A",
      sheetContexts: [
        {
          periodDate: "2026-06-01",
          signatureName: "Th/tá Nguyen Van A",
          nguoiNhan: "Nguyen Van A",
          lyDoXuatKho: "Cap tiep pham thang 06 nam 2026",
          xuatTaiKho: "Kho trung tam",
          diaDiem: "Doanh trai A",
          detailRows: [{ stt: 1, tenHang: "Gao" }],
        },
      ],
      detailRows: [{ stt: 1, tenHang: "Gao" }],
    },
    sourceDataHash: "pxk-hash-123",
  }));
  prismaSignatureSettingsFindUnique.mock.mockImplementation(async () => ({
    id: 7,
    categoryKey: "phieu-xuat-kho",
    signatureBlockJson: { columns: 2, slots: [{ key: "nguoi_nhan", label: "Nguoi nhan" }] },
    extraFieldsJson: { xuatTaiKho: "Kho trung tam", diaDiem: "Doanh trai A" },
    updatedById: 88,
    createdAt: new Date("2026-08-22T00:00:00.000Z"),
    updatedAt: new Date("2026-08-22T00:00:00.000Z"),
  }));

  const randomBytesMock = mock.method(crypto, "randomBytes", () =>
    Buffer.from("abcdef123456", "hex"),
  );
  try {
    await createChungTuPdfExportBatch({
      categoryKey: "phieu-xuat-kho",
      unitId: 9,
      periodMonth: "2026-06",
      aggregationMode: "by-unit",
      pdfTemplateId: 17,
      unitIds: [10],
      exportingUserProfile: { donVi: "Kho A" },
      signatures: {},
      signatureDates: {},
      settings: {},
      createdById: 88,
      effectiveUnitIds: [9, 10, 11],
    });

    assert.deepEqual(resolveChungTuContext.mock.calls[0].arguments[0], {
      categoryKey: "phieu-xuat-kho",
      unitId: 9,
      periodDate: undefined,
      periodMonth: "2026-06",
      issueSlipId: undefined,
      unitIds: [10],
      aggregationMode: "by-unit",
      xuatTaiKho: "Kho trung tam",
      diaDiem: "Doanh trai A",
      exportingUserProfile: { donVi: "Kho A" },
      settings: {},
    });
    assert.equal(renderToDocumentFolder.mock.callCount(), 1);
    assert.deepEqual(renderToDocumentFolder.mock.calls[0].arguments[1].signatureBlock, {
      columns: 2,
      slots: [
        {
          key: "nguoi_nhan",
          label: "NGƯỜI NHẬN",
          col: 0,
          col_span: 1,
          source: "static",
          static_name: "Th/tá Nguyen Van A",
          locked: true,
          show_date_line: false,
        },
      ],
    });
  } finally {
    randomBytesMock.mock.restore();
  }
});

test("createChungTuPdfExportBatch materializes empty nguoi_nhan when recipient missing", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 17,
    categoryKey: "phieu-xuat-kho",
    displayName: "PXK A",
    documentServiceTemplateId: 903,
    status: "published",
  }));
  resolveChungTuContext.mock.mockImplementationOnce(async () => ({
    context: {
      periodMonth: "2026-06",
      sheetContexts: [
        {
          periodDate: "2026-06-01",
          signatureName: "",
          nguoiNhan: "",
          detailRows: [{ stt: 1, tenHang: "Gao" }],
        },
      ],
      detailRows: [{ stt: 1, tenHang: "Gao" }],
    },
    sourceDataHash: "pxk-empty-recipient",
  }));
  prismaSignatureSettingsFindUnique.mock.mockImplementation(async () => ({
    id: 7,
    categoryKey: "phieu-xuat-kho",
    signatureBlockJson: { columns: 2, slots: [{ key: "nguoi_nhan", label: "Nguoi nhan" }] },
    extraFieldsJson: {},
    updatedById: 88,
    createdAt: new Date("2026-08-22T00:00:00.000Z"),
    updatedAt: new Date("2026-08-22T00:00:00.000Z"),
  }));

  const randomBytesMock = mock.method(crypto, "randomBytes", () =>
    Buffer.from("abcdef123456", "hex"),
  );
  try {
    await createChungTuPdfExportBatch({
      categoryKey: "phieu-xuat-kho",
      unitId: 9,
      periodMonth: "2026-06",
      aggregationMode: "by-unit",
      pdfTemplateId: 17,
      unitIds: [10],
      exportingUserProfile: { donVi: "Kho A" },
      signatures: {},
      signatureDates: {},
      settings: {},
      createdById: 88,
      effectiveUnitIds: [9, 10, 11],
    });

    assert.equal(renderToDocumentFolder.mock.callCount(), 1);
    assert.equal(
      renderToDocumentFolder.mock.calls[0].arguments[1].signatureBlock.slots[0].static_name,
      "",
    );
    assert.equal(
      renderToDocumentFolder.mock.calls[0].arguments[1].signatureBlock.slots[0].source,
      "static",
    );
  } finally {
    randomBytesMock.mock.restore();
  }
});

test("createChungTuPdfExportBatch keeps PNK full mode and forwards date range + PNK extra fields", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 16,
    categoryKey: "phieu-nhap-kho",
    displayName: "PNK A",
    documentServiceTemplateId: 902,
    status: "published",
  }));
  resolveChungTuContext.mock.mockImplementationOnce(async () => ({
    context: {
      periodDate: "2026-06-01",
      buyerSignatureName: "Th/tá Nguyen Van A",
      lyDoNhapKho: "Nhap hang bo sung",
      nhapTaiKho: "Kho trung tam",
      detailRows: [{ stt: 1, tenHang: "Gạo" }],
      sheetContexts: [
        {
          periodDate: "2026-06-01",
          buyerSignatureName: "Th/tá Nguyen Van A",
          lyDoNhapKho: "Nhap hang bo sung",
          nhapTaiKho: "Kho trung tam",
          detailRows: [{ stt: 1, tenHang: "Gạo" }],
        },
      ],
    },
    sourceDataHash: "pnk-hash-123",
  }));
  prismaSignatureSettingsFindUnique.mock.mockImplementation(async () => ({
    id: 6,
    categoryKey: "phieu-nhap-kho",
    signatureBlockJson: { columns: 1, slots: [{ key: "nguoi_giao", label: "Nguoi giao" }] },
    extraFieldsJson: { lyDoNhapKho: "Nhap hang bo sung", nhapTaiKho: "Kho trung tam" },
    updatedById: 88,
    createdAt: new Date("2026-08-22T00:00:00.000Z"),
    updatedAt: new Date("2026-08-22T00:00:00.000Z"),
  }));

  const randomBytesMock = mock.method(crypto, "randomBytes", () =>
    Buffer.from("abcdef123456", "hex"),
  );
  try {
    const result = await createChungTuPdfExportBatch({
      categoryKey: "phieu-nhap-kho",
      unitId: 9,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-03",
      aggregationMode: "full",
      pdfTemplateId: 16,
      exportingUserProfile: { donVi: "Kho A" },
      signatures: {},
      signatureDates: {},
      settings: {},
      createdById: 88,
      effectiveUnitIds: [9, 10, 11],
    });

    assert.deepEqual(resolveChungTuContext.mock.calls[0].arguments[0], {
      categoryKey: "phieu-nhap-kho",
      unitId: 9,
      periodDate: undefined,
      periodMonth: undefined,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-03",
      issueSlipId: undefined,
      unitIds: undefined,
      aggregationMode: "full",
      lyDoNhapKho: "Nhap hang bo sung",
      nhapTaiKho: "Kho trung tam",
      exportingUserProfile: { donVi: "Kho A" },
      settings: {},
    });
    assert.equal(prismaBatchCreate.mock.calls[0].arguments[0].data.aggregationMode, "full");
    assert.equal(prismaBatchCreate.mock.calls[0].arguments[0].data.periodMonth, "2026-06");
    assert.equal(
      prismaBatchCreate.mock.calls[0].arguments[0].data.periodDate.toISOString(),
      "2026-06-01T00:00:00.000Z",
    );
    assert.equal(renderToDocumentFolder.mock.callCount(), 1);
    assert.deepEqual(renderToDocumentFolder.mock.calls[0].arguments[1].signatureBlock, {
      columns: 1,
      slots: [
        {
          key: "nguoi_giao",
          label: "NGƯỜI GIAO",
          col: 0,
          col_span: 1,
          source: "static",
          static_name: "Th/tá Nguyen Van A",
          locked: true,
          show_date_line: false,
        },
      ],
    });
    assert.equal(result.fileCount, 1);
  } finally {
    randomBytesMock.mock.restore();
  }
});

test("getChungTuPdfExportBatch leaves summary fields null when summaryJson is missing", async () => {
  const now = new Date("2026-08-23T05:00:00.000Z");
  prismaBatchFindUnique.mock.mockImplementationOnce(async () => ({
    id: 42,
    batchKey: "ctpdf_batch_legacy",
    categoryKey: "bang-ke-mua-hang",
    unitId: 9,
    periodMonth: "2026-06",
    periodDate: new Date("2026-06-01T00:00:00.000Z"),
    issueSlipId: null,
    unitIdsJson: [10],
    aggregationMode: "by-day",
    pdfTemplateId: 15,
    documentServiceTemplateId: 901,
    documentServiceFolderId: 700,
    displayName: "BKMH legacy",
    fileCount: 1,
    sourceDataHash: "legacy-hash",
    signaturesJson: { signatures: {}, signatureDates: {} },
    createdById: 88,
    createdAt: now,
    updatedAt: now,
    exports: [
      {
        id: 1,
        exportKey: "ctpdf_legacy_1",
        fileName: "2026-06-01.pdf",
        documentServiceFileId: 10,
        sortKey: "2026-06-01",
        summaryJson: null,
        periodDate: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: now,
        updatedAt: now,
      },
    ],
  }));

  const result = await getChungTuPdfExportBatch({
    batchKey: "ctpdf_batch_legacy",
    effectiveUnitIds: [9, 10],
  });

  assert.equal(result.files.length, 1);
  const file = result.files[0];
  assert.equal(file.soChungTu, null);
  assert.equal(file.periodDate, null);
  assert.equal(file.ngayThangNam, null);
  assert.equal(file.tongTien, null);
  assert.equal(file.recipientUnitName, null);
  assert.equal(file.summary, null);
});

test("createChungTuPdfExportBatch passes template fieldLabelsJson into rendered payload", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 17,
    categoryKey: "bang-ke-mua-hang",
    displayName: "BKMH labels",
    documentServiceTemplateId: 903,
    status: "published",
    fieldLabelsJson: { soChungTu: "Số: " },
  }));
  prismaSignatureSettingsFindUnique.mock.mockImplementation(async () => null);
  resolveChungTuContext.mock.mockImplementationOnce(async () => ({
    context: {
      sheetContexts: [{ periodDate: "2026-06-01", soChungTu: "CT-01", detailRows: [{ stt: 1 }] }],
      detailRows: [{ stt: 1 }],
    },
    sourceDataHash: "batch-labels",
  }));
  getTemplateFields.mock.mockImplementationOnce(async () => ({
    fields: [{ field_name: "so_chung_tu", cell_ref: "B2" }],
    columns: [],
  }));

  const randomValues = ["abcdef123456", "111111111111"];
  const randomBytesMock = mock.method(crypto, "randomBytes", () =>
    Buffer.from(randomValues.shift() ?? "222222222222", "hex"),
  );
  try {
    await createChungTuPdfExportBatch({
      categoryKey: "bang-ke-mua-hang",
      unitId: 9,
      periodMonth: "2026-06",
      unitIds: [10],
      aggregationMode: "by-day",
      pdfTemplateId: 17,
      exportingUserProfile: { donVi: "Kho A" },
      settings: {},
      createdById: 88,
      effectiveUnitIds: [9, 10],
    });

    assert.deepEqual(renderToDocumentFolder.mock.calls.at(-1).arguments[1].fields, {
      so_chung_tu: "Số: CT-01",
    });
  } finally {
    randomBytesMock.mock.restore();
  }
});

test("reExportChungTuPdfExportBatch keeps folderId and snapshot numbers without refresh", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 21,
    categoryKey: "phieu-xuat-kho",
    displayName: "PXK",
    documentServiceTemplateId: 501,
    status: "published",
    fieldLabelsJson: null,
  }));
  prismaBatchFindUnique.mock.mockImplementation(async () => ({
    id: 91,
    batchKey: "batch_reexport",
    categoryKey: "phieu-xuat-kho",
    unitId: 9,
    periodMonth: "2026-09",
    periodDate: null,
    issueSlipId: null,
    unitIdsJson: [10, 11],
    aggregationMode: "by-unit",
    documentServiceFolderId: 700,
    displayName: "PXK 09/2026",
    fileCount: 2,
    sourceDataHash: "hash-old",
    signaturesJson: null,
    createdById: 88,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    pdfTemplateId: 20,
    documentServiceTemplateId: 500,
    exports: [
      {
        id: 1,
        fileName: "don-vi-10.pdf",
        sortKey: "unit:10",
        contextJson: {
          recipientUnitId: 10,
          recipientUnitName: "Đại đội 1",
          soChungTu: "0001",
          quyenSo: "0926",
          sheetKey: "unit:10",
          detailRows: [{ stt: 1, tenHang: "Gạo" }],
          tongTienSo: 1000,
        },
        summaryJson: { tongTienSo: 1000 },
      },
      {
        id: 2,
        fileName: "don-vi-11.pdf",
        sortKey: "unit:11",
        contextJson: {
          recipientUnitId: 11,
          recipientUnitName: "Đại đội 2",
          soChungTu: "0002",
          quyenSo: "0926",
          sheetKey: "unit:11",
          detailRows: [{ stt: 1, tenHang: "Muối" }],
          tongTienSo: 500,
        },
        summaryJson: { tongTienSo: 500 },
      },
    ],
  }));
  getTemplateFields.mock.mockImplementation(async () => ({
    fields: [{ field_name: "so_chung_tu", cell_ref: "B2" }],
    columns: [{ key: "stt", title: "STT" }],
  }));

  const result = await reExportChungTuPdfExportBatch({
    batchKey: "batch_reexport",
    pdfTemplateId: 21,
    refreshData: false,
    signatures: {},
    signatureDates: {},
    settings: {},
    createdById: 88,
    effectiveUnitIds: [9, 10, 11],
  });

  assert.equal(clearDocumentFolderFiles.mock.callCount(), 1);
  assert.deepEqual(clearDocumentFolderFiles.mock.calls[0].arguments, [700]);
  assert.equal(createDocumentFolder.mock.callCount(), 0);
  assert.equal(deleteDocumentFolder.mock.callCount(), 0);
  assert.equal(prismaExportDeleteMany.mock.callCount(), 1);
  assert.equal(resolveChungTuContext.mock.callCount(), 0);
  assert.equal(attachDocNumbersToContexts.mock.callCount(), 1);
  const attached = attachDocNumbersToContexts.mock.calls[0].arguments[0].contexts;
  assert.deepEqual(
    attached.map((c) => c.soChungTu),
    ["0001", "0002"],
  );
  assert.equal(result.folderId, 700);
  assert.equal(result.batchKey, "batch_reexport");
  assert.equal(result.pdfTemplateId, 21);
});

test("reExportChungTuPdfExportBatch without snapshot requires refreshData", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 21,
    categoryKey: "phieu-xuat-kho",
    displayName: "PXK",
    documentServiceTemplateId: 501,
    status: "published",
    fieldLabelsJson: null,
  }));
  prismaBatchFindUnique.mock.mockImplementation(async () => ({
    id: 91,
    batchKey: "batch_legacy",
    categoryKey: "phieu-xuat-kho",
    unitId: 9,
    periodMonth: "2026-09",
    periodDate: null,
    issueSlipId: null,
    unitIdsJson: [10],
    aggregationMode: "by-unit",
    documentServiceFolderId: 700,
    displayName: "PXK legacy",
    fileCount: 1,
    sourceDataHash: null,
    signaturesJson: null,
    createdById: 88,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    pdfTemplateId: 20,
    documentServiceTemplateId: 500,
    exports: [{ id: 1, fileName: "a.pdf", sortKey: "a", contextJson: null }],
  }));

  await assert.rejects(
    () =>
      reExportChungTuPdfExportBatch({
        batchKey: "batch_legacy",
        pdfTemplateId: 21,
        refreshData: false,
        createdById: 88,
        effectiveUnitIds: [9, 10],
      }),
    (err) => err?.statusCode === 400 && /Đọc lại dữ liệu/.test(String(err?.message ?? "")),
  );
});
