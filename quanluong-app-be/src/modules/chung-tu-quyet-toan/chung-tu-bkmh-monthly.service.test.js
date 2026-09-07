import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const prismaTemplateFindFirst = mock.fn(async () => null);
const prismaMonthlyCreate = mock.fn(async ({ data, include }) => {
  const now = new Date("2026-08-30T05:00:00.000Z");
  const slices = (data.slices?.create ?? []).map((item, index) => ({
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
    slices: include?.slices ? slices : undefined,
  };
});
const prismaMonthlyUpdate = mock.fn(async ({ where, data, include }) => {
  const now = new Date("2026-08-30T06:00:00.000Z");
  const slices = (data.slices?.create ?? []).map((item, index) => ({
    id: index + 21,
    createdAt: now,
    updatedAt: now,
    ...item,
  }));
  return {
    id: where.id,
    storageUnitId: 9,
    periodMonth: "2026-06",
    documentServiceFolderId: 700,
    aggregationMode: "by-day",
    unitIdsJson: [10, 11],
    displayName: "BKMH 06/2026",
    tongTienThang: 2000,
    sliceCount: slices.length,
    createdById: 77,
    updatedById: 77,
    createdAt: new Date("2026-08-29T05:00:00.000Z"),
    updatedAt: now,
    ...data,
    slices: include?.slices ? slices : undefined,
  };
});
const prismaMonthlyFindMany = mock.fn(async () => []);
const prismaMonthlyFindUnique = mock.fn(async () => null);
const prismaMonthlyDelete = mock.fn(async ({ where }) => ({ id: where.id }));
const prismaSliceDeleteMany = mock.fn(async () => ({ count: 0 }));
const prismaSignatureSettingsFindUnique = mock.fn(async () => null);
const prismaLttpDefaultsFindUnique = mock.fn(async () => null);

const resolveChungTuContext = mock.fn(async () => ({
  context: {
    periodMonth: "2026-06",
    donVi: "Kho A",
    tongTien: "2.000",
    sheetContexts: [
      {
        periodDate: "2026-06-01",
        soChungTu: "CT-01",
        recipientUnitId: 10,
        recipientUnitName: "Bep A",
        ngayThangNam: "Ngay 01 thang 06 nam 2026",
        tongTien: "1.000",
        detailRows: [{ stt: 1, tenHang: "Gao" }],
      },
      {
        periodDate: "2026-06-02",
        soChungTu: "CT-02",
        recipientUnitId: 10,
        recipientUnitName: "Bep A",
        ngayThangNam: "Ngay 02 thang 06 nam 2026",
        tongTien: "0",
        detailRows: [],
      },
      {
        periodDate: "2026-06-03",
        soChungTu: "CT-03",
        recipientUnitId: 11,
        recipientUnitName: "Bep B",
        ngayThangNam: "Ngay 03 thang 06 nam 2026",
        tongTien: "1.000",
        detailRows: [{ stt: 1, tenHang: "Muoi" }],
      },
    ],
  },
  sourceDataHash: "monthly-hash-123",
}));
const prepareSignatureBlockForRender = mock.fn(async (block) => block);

const getTemplateFields = mock.fn(async () => ({
  fields: [{ field_name: "don_vi", cell_ref: "B2" }, { field_name: "tong_tien", cell_ref: "B3" }],
  columns: [{ key: "stt", title: "STT" }, { key: "ten_mat_hang", title: "Ten mat hang" }],
}));

const createDocumentFolder = mock.fn(async ({ name }) => ({
  id: 700,
  name,
  created_at: "2026-08-30T05:00:00.000Z",
}));
const renderToDocumentFolder = mock.fn(async (_folderId, body) => ({
  file_id: renderToDocumentFolder.mock.callCount() + 10,
  file_name: body.fileName,
}));
const deleteDocumentFolder = mock.fn(async () => ({}));
const clearDocumentFolderFiles = mock.fn(async () => ({}));
const streamDocumentFolderZip = mock.fn(async (folderId) => ({ kind: "zip", folderId }));
const streamDocumentFolderMergedPdf = mock.fn(async (folderId) => ({ kind: "merged", folderId }));
const streamDocumentFolderFile = mock.fn(async (folderId, fileId) => ({
  kind: "file",
  folderId,
  fileId,
}));
const attachDocNumbersToContexts = mock.fn(async ({ contexts }) => {
  for (const ctx of contexts ?? []) {
    ctx.sheetKey = ctx.sheetKey || `day:${ctx.periodDate ?? "x"}`;
    ctx.quyenSo = ctx.quyenSo || "0626";
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
      chungTuBkmhMonthly: {
        create: prismaMonthlyCreate,
        update: prismaMonthlyUpdate,
        findMany: prismaMonthlyFindMany,
        findUnique: prismaMonthlyFindUnique,
        delete: prismaMonthlyDelete,
      },
      chungTuBkmhSlice: {
        deleteMany: prismaSliceDeleteMany,
      },
      chungTuSignatureSettings: {
        findUnique: prismaSignatureSettingsFindUnique,
        upsert: mock.fn(),
      },
      lttpUnitIssueFormDefaults: {
        findUnique: prismaLttpDefaultsFindUnique,
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
    streamDocumentFolderFile,
    streamDocumentFolderMergedPdf,
    streamDocumentFolderZip,
  },
});

const {
  createChungTuBkmhMonthlyExport,
  deleteChungTuBkmhMonthly,
  getChungTuBkmhMonthly,
  listChungTuBkmhMonthly,
  reExportChungTuBkmhMonthly,
  streamChungTuBkmhMonthlyMergedPdf,
  streamChungTuBkmhMonthlySliceFile,
  streamChungTuBkmhMonthlyZip,
} = await import("./chung-tu-bkmh-monthly.service.js");

test.beforeEach(() => {
  prismaTemplateFindFirst.mock.resetCalls();
  prismaMonthlyCreate.mock.resetCalls();
  prismaMonthlyUpdate.mock.resetCalls();
  prismaMonthlyFindMany.mock.resetCalls();
  prismaMonthlyFindUnique.mock.resetCalls();
  prismaMonthlyDelete.mock.resetCalls();
  prismaSliceDeleteMany.mock.resetCalls();
  prismaSignatureSettingsFindUnique.mock.resetCalls();
  prismaLttpDefaultsFindUnique.mock.resetCalls();
  resolveChungTuContext.mock.resetCalls();
  prepareSignatureBlockForRender.mock.resetCalls();
  attachDocNumbersToContexts.mock.resetCalls();
  getTemplateFields.mock.resetCalls();
  createDocumentFolder.mock.resetCalls();
  clearDocumentFolderFiles.mock.resetCalls();
  renderToDocumentFolder.mock.resetCalls();
  deleteDocumentFolder.mock.resetCalls();
  streamDocumentFolderZip.mock.resetCalls();
  streamDocumentFolderMergedPdf.mock.resetCalls();
  streamDocumentFolderFile.mock.resetCalls();
});

test("createChungTuBkmhMonthlyExport creates a new monthly row and persists non-empty slices", async () => {
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
    signatureBlockJson: { columns: 2, slots: [{ key: "ke_toan", label: "Ke toan" }] },
    updatedById: 88,
    createdAt: new Date("2026-08-22T00:00:00.000Z"),
    updatedAt: new Date("2026-08-22T00:00:00.000Z"),
  }));
  prismaMonthlyFindUnique.mock.mockImplementation(async () => null);

  const randomValues = ["abcdef123456", "111111111111", "222222222222"];
  const randomBytesMock = mock.method(crypto, "randomBytes", () =>
    Buffer.from(randomValues.shift() ?? "333333333333", "hex"),
  );

  try {
    const result = await createChungTuBkmhMonthlyExport({
      storageUnitId: 9,
      periodMonth: "2026-06",
      unitIds: [10, 11],
      aggregationMode: "by-day",
      pdfTemplateId: 15,
      signatures: { ke_toan: "Nguyen A" },
      signatureDates: { ke_toan: "Ngay 03 thang 06 nam 2026" },
      settings: { ghiChu: "ghi chu" },
      exportingUserProfile: {
        donViCapTren: "Su doan 372",
        donVi: "Tieu doan 1",
      },
      createdById: 88,
      effectiveUnitIds: [9, 10, 11],
    });

    assert.deepEqual(prismaTemplateFindFirst.mock.calls[0].arguments[0], {
      where: {
        id: 15,
        status: "published",
        categoryKey: "bang-ke-mua-hang",
      },
    });
    assert.deepEqual(prismaMonthlyFindUnique.mock.calls[0].arguments[0], {
      where: {
        storageUnitId_periodMonth: {
          storageUnitId: 9,
          periodMonth: "2026-06",
        },
      },
      select: { id: true },
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
      resolvedBkmhBuyer: null,
    });
    assert.equal(createDocumentFolder.mock.callCount(), 1);
    assert.equal(renderToDocumentFolder.mock.callCount(), 2);
    assert.deepEqual(
      renderToDocumentFolder.mock.calls.map((call) => call.arguments[1].fileName),
      ["Bep A-2026-06-01.pdf", "Bep B-2026-06-03.pdf"],
    );

    const createdPayload = prismaMonthlyCreate.mock.calls[0].arguments[0].data;
    assert.equal(createdPayload.storageUnitId, 9);
    assert.equal(createdPayload.periodMonth, "2026-06");
    assert.equal(createdPayload.aggregationMode, "by-day");
    assert.deepEqual(createdPayload.unitIdsJson, [10, 11]);
    assert.equal(createdPayload.documentServiceTemplateId, 901);
    assert.equal(createdPayload.documentServiceFolderId, 700);
    assert.equal(createdPayload.displayName, "BKMH 06/2026 — Kho A");
    assert.equal(createdPayload.tongTienThang, 2000);
    assert.equal(createdPayload.sliceCount, 2);
    assert.equal(createdPayload.sourceDataHash, "monthly-hash-123");
    assert.equal(createdPayload.createdById, 88);
    assert.equal(createdPayload.updatedById, 88);
    assert.deepEqual(createdPayload.signaturesJson, {
      signatures: { ke_toan: "Nguyen A" },
      signatureDates: { ke_toan: "Ngay 03 thang 06 nam 2026" },
      signatureBlock: { columns: 2, slots: [{ key: "ke_toan", label: "Ke toan" }] },
    });
    assert.equal(createdPayload.slices.create.length, 2);
    assert.deepEqual(createdPayload.slices.create[0], {
      sortKey: "Bep A-2026-06-01",
      soChungTu: "CT-01",
      periodDate: new Date("2026-06-01T00:00:00.000Z"),
      recipientUnitId: 10,
      recipientUnitName: "Bep A",
      ngayThangNam: "Ngay 01 thang 06 nam 2026",
      tongTien: 1000,
      detailRowsJson: [
        {
          stt: 1,
          tenHang: "Gao",
          commodityId: null,
          quantity: null,
          unitPrice: null,
          amount: null,
        },
      ],
      buyerUserId: null,
      buyerKey: "",
      buyerName: "",
      buyerSignatureName: "",
      buyerTitle: "",
      documentServiceFileId: 10,
      fileName: "Bep A-2026-06-01.pdf",
    });
    assert.deepEqual(createdPayload.slices.create[1].detailRowsJson, [
      {
        stt: 1,
        tenHang: "Muoi",
        commodityId: null,
        quantity: null,
        unitPrice: null,
        amount: null,
      },
    ]);

    assert.equal(result.id, 91);
    assert.equal(result.storageUnitId, 9);
    assert.equal(result.tongTienThang, 2000);
    assert.equal(result.sliceCount, 2);
    assert.equal(result.folderId, 700);
    assert.equal(result.zipPath, "/chungtuquyettoan/bkmh-monthly/91/zip");
    assert.equal(result.mergedPdfPath, "/chungtuquyettoan/bkmh-monthly/91/merged.pdf");
    assert.equal(result.slices.length, 2);
    assert.equal(result.slices[0].filePath, "/chungtuquyettoan/bkmh-monthly/91/slices/1/file");
    assert.deepEqual(result.slices[0].detailRows, [
      {
        stt: 1,
        tenHang: "Gao",
        commodityId: null,
        quantity: null,
        unitPrice: null,
        amount: null,
      },
    ]);
  } finally {
    randomBytesMock.mock.restore();
  }
});

test("createChungTuBkmhMonthlyExport rejects when month already exported", async () => {
  prismaMonthlyFindUnique.mock.mockImplementation(async ({ where }) => {
    if (where?.storageUnitId_periodMonth) {
      return {
        id: 44,
        storageUnitId: 9,
        periodMonth: "2026-06",
      };
    }
    return null;
  });

  await assert.rejects(
    () =>
      createChungTuBkmhMonthlyExport({
        storageUnitId: 9,
        periodMonth: "2026-06",
        unitIds: [10, 11],
        aggregationMode: "by-day",
        pdfTemplateId: 15,
        signatures: {},
        signatureDates: {},
        settings: {},
        exportingUserProfile: { donVi: "Kho A" },
        createdById: 88,
        effectiveUnitIds: [9, 10, 11],
      }),
    (err) =>
      err?.statusCode === 400 &&
      /Xuất lại/.test(String(err?.message ?? "")) &&
      Number(err?.details?.monthlyId) === 44,
  );
  assert.equal(createDocumentFolder.mock.callCount(), 0);
  assert.equal(deleteDocumentFolder.mock.callCount(), 0);
  assert.equal(prismaMonthlyUpdate.mock.callCount(), 0);
});

test("reExportChungTuBkmhMonthly clears same folder and keeps soChungTu without refresh", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 15,
    categoryKey: "bang-ke-mua-hang",
    displayName: "BKMH A",
    documentServiceTemplateId: 901,
    status: "published",
    fieldLabelsJson: null,
  }));
  const now = new Date("2026-08-30T07:00:00.000Z");
  prismaMonthlyFindUnique.mock.mockImplementation(async () => ({
    id: 55,
    storageUnitId: 9,
    periodMonth: "2026-06",
    aggregationMode: "by-day",
    unitIdsJson: [10, 11],
    pdfTemplateId: 14,
    documentServiceTemplateId: 900,
    documentServiceFolderId: 700,
    displayName: "BKMH 06/2026",
    tongTienThang: 2000,
    sliceCount: 1,
    sourceDataHash: "monthly-hash-123",
    signaturesJson: null,
    createdById: 88,
    updatedById: 88,
    createdAt: now,
    updatedAt: now,
    slices: [
      {
        id: 1,
        monthlyId: 55,
        sortKey: "2026-06-01",
        soChungTu: "0003",
        periodDate: new Date("2026-06-01T00:00:00.000Z"),
        recipientUnitId: 10,
        recipientUnitName: "Đại đội 1",
        ngayThangNam: "Ngày 01 tháng 06 năm 2026",
        tongTien: 2000,
        fileName: "2026-06-01.pdf",
        documentServiceFileId: 11,
        detailRowsJson: [{ stt: 1, tenHang: "Gao", quantity: 1, unitPrice: 2000, amount: 2000 }],
      },
    ],
  }));
  getTemplateFields.mock.mockImplementation(async () => ({
    fields: [{ field_name: "so_chung_tu", cell_ref: "B2" }],
    columns: [{ key: "stt", title: "STT" }],
  }));

  const result = await reExportChungTuBkmhMonthly({
    id: 55,
    pdfTemplateId: 15,
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
  assert.equal(resolveChungTuContext.mock.callCount(), 0);
  assert.equal(attachDocNumbersToContexts.mock.callCount(), 1);
  assert.equal(attachDocNumbersToContexts.mock.calls[0].arguments[0].contexts[0].soChungTu, "0003");
  assert.equal(result.folderId, 700);
});

test("list/get/delete and stream helpers map rows and proxy document-service calls", async () => {
  const now = new Date("2026-08-30T07:00:00.000Z");
  const row = {
    id: 55,
    storageUnitId: 9,
    periodMonth: "2026-06",
    aggregationMode: "by-day",
    unitIdsJson: [10, 11],
    pdfTemplateId: 15,
    documentServiceTemplateId: 901,
    documentServiceFolderId: 700,
    displayName: "BKMH 06/2026 — Kho A",
    tongTienThang: 2000,
    sliceCount: 2,
    sourceDataHash: "monthly-hash-123",
    signaturesJson: null,
    createdById: 88,
    updatedById: 88,
    createdAt: now,
    updatedAt: now,
    slices: [
      {
        id: 1,
        monthlyId: 55,
        sortKey: "2026-06-01",
        soChungTu: "CT-01",
        periodDate: new Date("2026-06-01T00:00:00.000Z"),
        recipientUnitId: 10,
        recipientUnitName: "Bep A",
        ngayThangNam: "Ngay 01 thang 06 nam 2026",
        tongTien: 1000,
        detailRowsJson: [
          {
            stt: 1,
            tenHang: "Gao",
            commodityId: 7,
            quantity: 2,
            unitPrice: 10000,
            amount: 20000,
          },
        ],
        documentServiceFileId: 10,
        fileName: "2026-06-01.pdf",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  prismaMonthlyFindMany.mock.mockImplementation(async () => [row]);
  prismaMonthlyFindUnique.mock.mockImplementation(async ({ where }) => {
    if (where?.id === 55) return row;
    return null;
  });

  const items = await listChungTuBkmhMonthly({
    storageUnitId: 9,
    periodMonth: "2026-06",
    effectiveUnitIds: [9],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].slices[0].filePath, "/chungtuquyettoan/bkmh-monthly/55/slices/1/file");
  assert.deepEqual(items[0].slices[0].detailRows, [
    {
      stt: 1,
      tenHang: "Gao",
      commodityId: 7,
      quantity: 2,
      unitPrice: 10000,
      amount: 20000,
    },
  ]);

  const detail = await getChungTuBkmhMonthly({
    id: 55,
    effectiveUnitIds: [9],
  });
  assert.equal(detail.id, 55);
  assert.deepEqual(detail.slices[0].detailRows, items[0].slices[0].detailRows);

  const zip = await streamChungTuBkmhMonthlyZip({
    id: 55,
    effectiveUnitIds: [9],
  });
  assert.deepEqual(zip, { kind: "zip", folderId: 700 });

  const merged = await streamChungTuBkmhMonthlyMergedPdf({
    id: 55,
    effectiveUnitIds: [9],
  });
  assert.deepEqual(merged, { kind: "merged", folderId: 700 });

  const file = await streamChungTuBkmhMonthlySliceFile({
    id: 55,
    sliceId: 1,
    effectiveUnitIds: [9],
  });
  assert.deepEqual(file, { kind: "file", folderId: 700, fileId: 10 });

  const deleted = await deleteChungTuBkmhMonthly({
    id: 55,
    effectiveUnitIds: [9],
  });
  assert.deepEqual(deleted, { id: 55, deleted: true });
  assert.deepEqual(prismaMonthlyDelete.mock.calls[0].arguments[0], {
    where: { id: 55 },
  });
});

test("createChungTuBkmhMonthlyExport falls back to raw value when template fieldLabelsJson is empty", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 16,
    categoryKey: "bang-ke-mua-hang",
    displayName: "BKMH raw",
    documentServiceTemplateId: 902,
    status: "published",
    fieldLabelsJson: {},
  }));
  prismaSignatureSettingsFindUnique.mock.mockImplementation(async () => null);
  prismaMonthlyFindUnique.mock.mockImplementation(async () => null);
  resolveChungTuContext.mock.mockImplementationOnce(async () => ({
    context: {
      periodMonth: "2026-06",
      donVi: "Kho A",
      sheetContexts: [{ periodDate: "2026-06-01", soChungTu: "CT-01", detailRows: [{ stt: 1 }] }],
    },
    sourceDataHash: "monthly-raw",
  }));
  getTemplateFields.mock.mockImplementationOnce(async () => ({
    fields: [{ field_name: "so_chung_tu", cell_ref: "B2" }],
    columns: [],
  }));

  const randomBytesMock = mock.method(crypto, "randomBytes", () => Buffer.from("abcdef123456", "hex"));
  try {
    await createChungTuBkmhMonthlyExport({
      storageUnitId: 9,
      periodMonth: "2026-06",
      unitIds: [10],
      aggregationMode: "by-day",
      pdfTemplateId: 16,
      signatures: {},
      signatureDates: {},
      settings: {},
      exportingUserProfile: { donVi: "Kho A" },
      createdById: 88,
      effectiveUnitIds: [9, 10],
    });

    assert.deepEqual(renderToDocumentFolder.mock.calls.at(-1).arguments[1].fields, {
      so_chung_tu: "CT-01",
    });
  } finally {
    randomBytesMock.mock.restore();
  }
});
