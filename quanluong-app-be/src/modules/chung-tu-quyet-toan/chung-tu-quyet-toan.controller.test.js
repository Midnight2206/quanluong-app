import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const getChungTuQuyetToanHealth = mock.fn(async () => ({}));
const getTemplateFillRules = mock.fn(async () => ({}));
const importFileToGoogleWorkspace = mock.fn(async () => ({}));
const listDriveTemplates = mock.fn(async () => ({ items: [] }));
const listSpreadsheetNamedRanges = mock.fn(async () => ({ items: [] }));
const putTemplateFillRules = mock.fn(async () => ({}));

const createTemplateCatalogFromUploadedOfficeFile = mock.fn(async () => ({}));
const createTemplateCatalogLink = mock.fn(async () => ({}));
const deleteTemplateCatalogLink = mock.fn(async () => ({}));
const listTemplateCatalogForApp = mock.fn(async () => ({ items: [] }));
const listTemplateCatalogManage = mock.fn(async () => ({ items: [] }));
const patchTemplateCatalogLink = mock.fn(async () => ({}));

const seedUserTemplatesFromSystem = mock.fn(async () => ({ totals: { available: 0, copied: 0, skipped: 0 } }));
const listTemplateFolderBrowse = mock.fn(async () => ({}));
const resolveTemplateSelectionMeta = mock.fn(async () => ({}));

const checkDocumentStale = mock.fn(async () => ({}));
const createOrGetChungTuDocument = mock.fn(async () => ({}));
const deleteChungTuDocument = mock.fn(async () => ({}));
const getChungTuDocumentByKey = mock.fn(async () => ({}));
const listChungTuDocuments = mock.fn(async () => []);
const previewChungTuContext = mock.fn(async () => ({ context: {}, sourceDataHash: "preview-hash" }));
const syncChungTuDocument = mock.fn(async () => ({}));
const listBkmhSnapshotsByDocumentKey = mock.fn(async () => ({ items: [] }));

const createChungTuPdfExport = mock.fn(async () => ({ exportKey: "exp_1" }));
const deleteChungTuPdfExport = mock.fn(async () => ({}));
const getChungTuPdfExportFile = mock.fn(async () => ({ buffer: Buffer.from("pdf"), fileName: "x.pdf" }));
const listChungTuPdfExports = mock.fn(async () => []);

const createChungTuPdfExportBatch = mock.fn(async () => ({ batchKey: "batch_1" }));
const deleteChungTuPdfExportBatch = mock.fn(async () => ({}));
const exportChungTuPdfExportBatchSummaryExcel = mock.fn(async () => ({
  buffer: Buffer.from("xlsx"),
  fileName: "batch-summary.xlsx",
}));
const getChungTuPdfExportBatch = mock.fn(async () => ({}));
const listChungTuPdfExportBatches = mock.fn(async () => []);
const streamChungTuPdfExportBatchFile = mock.fn(async () => ({}));
const streamChungTuPdfExportBatchMergedPdf = mock.fn(async () => ({}));
const streamChungTuPdfExportBatchZip = mock.fn(async () => ({}));

const createChungTuBkmhMonthlyExport = mock.fn(async () => ({}));
const deleteChungTuBkmhMonthly = mock.fn(async () => ({}));
const exportChungTuBkmhMonthlySummaryExcel = mock.fn(async () => ({
  buffer: Buffer.from("xlsx"),
  fileName: "summary.xlsx",
}));
const getChungTuBkmhMonthly = mock.fn(async () => ({}));
const listChungTuBkmhMonthly = mock.fn(async () => []);
const streamChungTuBkmhMonthlyMergedPdf = mock.fn(async () => ({}));
const streamChungTuBkmhMonthlySliceFile = mock.fn(async () => ({}));
const streamChungTuBkmhMonthlyZip = mock.fn(async () => ({}));

const getChungTuUnitProfile = mock.fn(async () => ({}));
const putChungTuUnitProfile = mock.fn(async () => ({}));
const getCategoryTemplateFillMapping = mock.fn(async () => ({}));
const putCategoryTemplateFillMapping = mock.fn(async () => ({}));

const createChungTuPdfTemplate = mock.fn(async () => ({}));
const getChungTuPdfTemplateFields = mock.fn(async () => ({}));
const listChungTuPdfTemplates = mock.fn(async () => []);
const previewChungTuPdfTemplate = mock.fn(async () => ({
  upstreamResponse: { headers: new Headers(), body: null },
  fallbackContentDisposition: 'inline; filename="preview.pdf"',
}));
const publishChungTuPdfTemplate = mock.fn(async () => ({}));
const retireChungTuPdfTemplate = mock.fn(async () => ({}));
const updateChungTuPdfTemplateFieldLabels = mock.fn(async () => ({}));

const getChungTuSignatureSettings = mock.fn(async () => null);
const upsertChungTuSignatureSettings = mock.fn(async () => ({}));
const getChungTuBkmhHeaderSettings = mock.fn(async () => null);
const upsertChungTuBkmhHeaderSettings = mock.fn(async () => ({}));

mock.module("./chung-tu-quyet-toan.service.js", {
  exports: {
    getChungTuQuyetToanHealth,
    getTemplateFillRules,
    importFileToGoogleWorkspace,
    listDriveTemplates,
    listSpreadsheetNamedRanges,
    putTemplateFillRules,
  },
});

mock.module("./chung-tu-template-catalog.service.js", {
  exports: {
    createTemplateCatalogFromUploadedOfficeFile,
    createTemplateCatalogLink,
    deleteTemplateCatalogLink,
    listTemplateCatalogForApp,
    listTemplateCatalogManage,
    patchTemplateCatalogLink,
  },
});

mock.module("./chung-tu-context-field-registry.js", {
  exports: {
    getContextFieldRegistryForCategory: mock.fn(() => ({})),
  },
});

mock.module("./chung-tu-template-seed.service.js", {
  exports: { seedUserTemplatesFromSystem },
});

mock.module("./chung-tu-template-tree.service.js", {
  exports: {
    listTemplateFolderBrowse,
    resolveTemplateSelectionMeta,
  },
});

mock.module("./chung-tu-document.service.js", {
  exports: {
    checkDocumentStale,
    createOrGetChungTuDocument,
    deleteChungTuDocument,
    getChungTuDocumentByKey,
    listChungTuDocuments,
    previewChungTuContext,
    syncChungTuDocument,
    listBkmhSnapshotsByDocumentKey,
  },
});

mock.module("./chung-tu-pdf-export.service.js", {
  exports: {
    createChungTuPdfExport,
    deleteChungTuPdfExport,
    getChungTuPdfExportFile,
    listChungTuPdfExports,
  },
});

mock.module("./chung-tu-pdf-export-batch.service.js", {
  exports: {
    createChungTuPdfExportBatch,
    deleteChungTuPdfExportBatch,
    exportChungTuPdfExportBatchSummaryExcel,
    getChungTuPdfExportBatch,
    listChungTuPdfExportBatches,
    streamChungTuPdfExportBatchFile,
    streamChungTuPdfExportBatchMergedPdf,
    streamChungTuPdfExportBatchZip,
  },
});

mock.module("./chung-tu-bkmh-monthly.service.js", {
  exports: {
    createChungTuBkmhMonthlyExport,
    deleteChungTuBkmhMonthly,
    exportChungTuBkmhMonthlySummaryExcel,
    getChungTuBkmhMonthly,
    listChungTuBkmhMonthly,
    streamChungTuBkmhMonthlyMergedPdf,
    streamChungTuBkmhMonthlySliceFile,
    streamChungTuBkmhMonthlyZip,
  },
});

mock.module("./chung-tu-unit-profile.service.js", {
  exports: { getChungTuUnitProfile, putChungTuUnitProfile },
});

mock.module("./chung-tu-template-fill-config.service.js", {
  exports: { getCategoryTemplateFillMapping, putCategoryTemplateFillMapping },
});

mock.module("./chung-tu-pdf-template.service.js", {
  exports: {
    createChungTuPdfTemplate,
    getChungTuPdfTemplateFields,
    listChungTuPdfTemplates,
    previewChungTuPdfTemplate,
    publishChungTuPdfTemplate,
    retireChungTuPdfTemplate,
    updateChungTuPdfTemplateFieldLabels,
  },
});

mock.module("./chung-tu-signature-settings.service.js", {
  exports: {
    getChungTuSignatureSettings,
    upsertChungTuSignatureSettings,
  },
});

mock.module("./chung-tu-bkmh-header-settings.service.js", {
  exports: {
    getChungTuBkmhHeaderSettings,
    upsertChungTuBkmhHeaderSettings,
  },
});

mock.module("./chung-tu-pdf-field-catalog.js", {
  exports: {
    getChungTuPdfFieldCatalog: mock.fn(() => []),
  },
});

const {
  createChungTuPdfExportBatchController,
  createChungTuPdfExportController,
  previewChungTuContextController,
  putChungTuPdfTemplateFieldLabelsController,
} = await import("./chung-tu-quyet-toan.controller.js");

function makeRes() {
  return {
    statusCode: null,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return payload;
    },
  };
}

test.beforeEach(() => {
  createChungTuPdfExport.mock.resetCalls();
  createChungTuPdfExportBatch.mock.resetCalls();
  previewChungTuContext.mock.resetCalls();
  updateChungTuPdfTemplateFieldLabels.mock.resetCalls();
});

test("createChungTuPdfExportController forwards PNK date range to service", async () => {
  const req = {
    validatedBody: {
      categoryKey: "phieu-nhap-kho",
      unitId: 9,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-03",
      aggregationMode: "full",
      pdfTemplateId: 16,
      settings: { ghiChu: "PNK" },
    },
    user: {
      id: 88,
      profile: { donVi: "Kho A" },
    },
    effectiveUnitIds: [9, 10],
  };
  const res = makeRes();

  await createChungTuPdfExportController(req, res);

  assert.deepEqual(createChungTuPdfExport.mock.calls[0].arguments[0], {
    categoryKey: "phieu-nhap-kho",
    unitId: 9,
    periodDate: undefined,
    periodMonth: undefined,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-03",
    issueSlipId: undefined,
    unitIds: undefined,
    aggregationMode: "full",
    pdfTemplateId: 16,
    signatures: undefined,
    signatureDates: undefined,
    signatureBlock: undefined,
    settings: { ghiChu: "PNK" },
    exportingUserProfile: { donVi: "Kho A" },
    createdById: 88,
    effectiveUnitIds: [9, 10],
  });
  assert.equal(res.statusCode, 201);
});

test("createChungTuPdfExportBatchController forwards PNK date range to service", async () => {
  const req = {
    validatedBody: {
      categoryKey: "phieu-nhap-kho",
      unitId: 9,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-03",
      aggregationMode: "by-day",
      pdfTemplateId: 16,
      settings: { ghiChu: "PNK batch" },
    },
    user: {
      id: 88,
      profile: { donVi: "Kho A" },
    },
    effectiveUnitIds: [9, 10],
  };
  const res = makeRes();

  await createChungTuPdfExportBatchController(req, res);

  assert.deepEqual(createChungTuPdfExportBatch.mock.calls[0].arguments[0], {
    categoryKey: "phieu-nhap-kho",
    unitId: 9,
    periodDate: undefined,
    periodMonth: undefined,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-03",
    issueSlipId: undefined,
    unitIds: undefined,
    aggregationMode: "by-day",
    pdfTemplateId: 16,
    signatures: undefined,
    signatureDates: undefined,
    signatureBlock: undefined,
    settings: { ghiChu: "PNK batch" },
    exportingUserProfile: { donVi: "Kho A" },
    createdById: 88,
    effectiveUnitIds: [9, 10],
  });
  assert.equal(res.statusCode, 201);
});

test("previewChungTuContextController forwards PNK date range to service", async () => {
  const req = {
    validatedBody: {
      categoryKey: "phieu-nhap-kho",
      unitId: 9,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-03",
      aggregationMode: "full",
      settings: { ghiChu: "preview" },
    },
    user: {
      profile: { donVi: "Kho A" },
    },
    effectiveUnitIds: [9, 10],
  };
  const res = makeRes();

  await previewChungTuContextController(req, res);

  assert.deepEqual(previewChungTuContext.mock.calls[0].arguments[0], {
    categoryKey: "phieu-nhap-kho",
    unitId: 9,
    periodDate: undefined,
    periodMonth: undefined,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-03",
    issueSlipId: undefined,
    unitIds: undefined,
    aggregationMode: "full",
    settings: { ghiChu: "preview" },
    exportingUserProfile: { donVi: "Kho A" },
    effectiveUnitIds: [9, 10],
  });
  assert.equal(res.statusCode, 200);
});

test("putChungTuPdfTemplateFieldLabelsController forwards id and fieldLabels to service", async () => {
  updateChungTuPdfTemplateFieldLabels.mock.mockImplementation(async () => ({
    id: 17,
    fieldLabels: { soChungTu: "Số: " },
  }));
  const req = {
    validatedParams: { id: 17 },
    validatedBody: {
      fieldLabels: {
        soChungTu: "Số: ",
        tongTien: "Không lưu",
      },
    },
  };
  const res = makeRes();

  await putChungTuPdfTemplateFieldLabelsController(req, res);

  assert.deepEqual(updateChungTuPdfTemplateFieldLabels.mock.calls[0].arguments[0], {
    id: 17,
    fieldLabels: {
      soChungTu: "Số: ",
      tongTien: "Không lưu",
    },
  });
  assert.equal(res.statusCode, 200);
});
