import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const prismaTemplateFindFirst = mock.fn(async () => null);
const prismaExportCreate = mock.fn(async ({ data }) => ({
  id: 77,
  createdAt: new Date("2026-08-23T04:30:00.000Z"),
  updatedAt: new Date("2026-08-23T04:30:00.000Z"),
  ...data,
}));
const resolveChungTuContext = mock.fn(async () => ({
  context: {
    donVi: "Kho A",
    tongTien: "1.000",
    detailRows: [{ stt: 1, tenHang: "Gạo" }],
  },
  sourceDataHash: "hash-123",
}));
const getTemplateFields = mock.fn(async () => ({
  fields: [{ field_name: "don_vi", cell_ref: "B2" }, { field_name: "tong_tien", cell_ref: "B3" }],
  columns: [{ key: "stt", title: "STT" }, { key: "ten_hang", title: "Ten hang" }],
}));
const renderDocumentPdf = mock.fn(async () => Buffer.from("%PDF-1.4 test"));
const writeChungTuPdfFile = mock.fn(async () => "/tmp/chung-tu.pdf");
const deleteChungTuPdfFile = mock.fn(async () => {});

mock.module("../../infra/database/prisma/prisma.client.js", {
  exports: {
    prisma: {
      chungTuPdfTemplate: {
        findFirst: prismaTemplateFindFirst,
      },
      chungTuPdfExport: {
        create: prismaExportCreate,
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
    getTemplateFields,
    renderDocumentPdf,
  },
});

mock.module("./chung-tu-pdf-storage.util.js", {
  exports: {
    buildChungTuPdfRelativePath: ({ categoryKey, exportKey, year }) =>
      `chung-tu-pdf/${categoryKey}/${year}/${exportKey}.pdf`,
    writeChungTuPdfFile,
    readChungTuPdfFile: mock.fn(),
    deleteChungTuPdfFile,
  },
});

const { createChungTuPdfExport, extractTemplateKeys } = await import(
  "./chung-tu-pdf-export.service.js"
);

test("extractTemplateKeys reads document-service field_name and column key shape", () => {
  const { fieldKeys, columnKeys } = extractTemplateKeys({
    fields: [
      { field_name: "don_vi", cell_ref: "B2" },
      { field_name: "tong_tien", cell_ref: "B3" },
    ],
    columns: [{ key: "stt", title: "STT" }, { key: "ten_hang", title: "Ten hang" }],
  });

  assert.deepEqual(fieldKeys, ["don_vi", "tong_tien"]);
  assert.deepEqual(columnKeys, ["stt", "ten_hang"]);
});

test.beforeEach(() => {
  prismaTemplateFindFirst.mock.resetCalls();
  prismaExportCreate.mock.resetCalls();
  resolveChungTuContext.mock.resetCalls();
  getTemplateFields.mock.resetCalls();
  renderDocumentPdf.mock.resetCalls();
  writeChungTuPdfFile.mock.resetCalls();
  deleteChungTuPdfFile.mock.resetCalls();
});

test("createChungTuPdfExport renders document-service PDF, stores file, and returns download metadata", async () => {
  prismaTemplateFindFirst.mock.mockImplementation(async () => ({
    id: 15,
    categoryKey: "bang-ke-mua-hang",
    displayName: "BKMH A",
    documentServiceTemplateId: 901,
    status: "published",
  }));

  const randomBytesMock = mock.method(crypto, "randomBytes", () => Buffer.from("abcdef123456", "hex"));
  try {
    const result = await createChungTuPdfExport({
      categoryKey: "bang-ke-mua-hang",
      unitId: 9,
      periodDate: "2026-08-23",
      pdfTemplateId: 15,
      signatures: { nguoi_lap: "Nguyen Van A" },
      signatureDates: { nguoi_lap: "Ngay 23 thang 08 nam 2026" },
      signatureBlock: { slots: [{ key: "nguoi_lap", label: "Nguoi lap" }], columns: 1 },
      settings: { ghiChu: "ghi chu" },
      createdById: 88,
      effectiveUnitIds: [9, 10],
    });

    assert.equal(prismaTemplateFindFirst.mock.callCount(), 1);
    assert.deepEqual(prismaTemplateFindFirst.mock.calls[0].arguments[0], {
      where: {
        id: 15,
        status: "published",
        categoryKey: "bang-ke-mua-hang",
      },
    });

    assert.equal(resolveChungTuContext.mock.callCount(), 1);
    assert.deepEqual(resolveChungTuContext.mock.calls[0].arguments[0], {
      categoryKey: "bang-ke-mua-hang",
      unitId: 9,
      periodDate: "2026-08-23",
      periodMonth: undefined,
      issueSlipId: undefined,
      unitIds: undefined,
      aggregationMode: undefined,
      settings: { ghiChu: "ghi chu" },
    });

    assert.equal(getTemplateFields.mock.callCount(), 1);
    assert.deepEqual(getTemplateFields.mock.calls[0].arguments, [901]);

    assert.equal(renderDocumentPdf.mock.callCount(), 1);
    assert.deepEqual(renderDocumentPdf.mock.calls[0].arguments, [
      901,
      {
        fields: { don_vi: "Kho A", tong_tien: "1.000" },
        rows: [{ stt: "1", ten_hang: "Gạo" }],
        signatures: { nguoi_lap: "Nguyen Van A" },
        signature_dates: { nguoi_lap: "Ngay 23 thang 08 nam 2026" },
        signature_block: { slots: [{ key: "nguoi_lap", label: "Nguoi lap" }], columns: 1 },
      },
    ]);

    assert.equal(writeChungTuPdfFile.mock.callCount(), 1);
    assert.match(
      writeChungTuPdfFile.mock.calls[0].arguments[0],
      /^chung-tu-pdf\/bang-ke-mua-hang\/2026\/ctpdf_\d+_abcdef123456\.pdf$/,
    );

    assert.equal(prismaExportCreate.mock.callCount(), 1);
    const createdPayload = prismaExportCreate.mock.calls[0].arguments[0].data;
    assert.equal(createdPayload.categoryKey, "bang-ke-mua-hang");
    assert.equal(createdPayload.unitId, 9);
    assert.equal(createdPayload.periodDate.toISOString(), "2026-08-23T00:00:00.000Z");
    assert.equal(createdPayload.issueSlipId, null);
    assert.deepEqual(createdPayload.unitIdsJson, []);
    assert.equal(createdPayload.pdfTemplateId, 15);
    assert.equal(createdPayload.documentServiceTemplateId, 901);
    assert.equal(createdPayload.sourceDataHash, "hash-123");
    assert.deepEqual(createdPayload.signaturesJson, {
      signatures: { nguoi_lap: "Nguyen Van A" },
      signatureDates: { nguoi_lap: "Ngay 23 thang 08 nam 2026" },
      signatureBlock: { slots: [{ key: "nguoi_lap", label: "Nguoi lap" }], columns: 1 },
    });
    assert.match(createdPayload.fileName, /^bang-ke-mua-hang-ctpdf_\d+_abcdef123456\.pdf$/);
    assert.match(createdPayload.exportKey, /^ctpdf_\d+_abcdef123456$/);

    assert.equal(result.exportKey, createdPayload.exportKey);
    assert.equal(result.downloadPath, `/chungtuquyettoan/pdf-exports/${createdPayload.exportKey}/file`);
    assert.equal(result.fileName, createdPayload.fileName);
  } finally {
    randomBytesMock.mock.restore();
  }
});
