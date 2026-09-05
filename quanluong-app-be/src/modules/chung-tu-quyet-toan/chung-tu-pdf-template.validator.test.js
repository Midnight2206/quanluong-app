import assert from "node:assert/strict";
import test from "node:test";

import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";
import {
  chungTuBkmhHeaderSettingsPutBodySchema,
  chungTuPdfExportCreateBodySchema,
  chungTuPdfTemplateIdParamSchema,
  chungTuPdfTemplateListQuerySchema,
  chungTuPdfTemplateUploadBodySchema,
} from "./chung-tu-quyet-toan.validator.js";

test("chungTuPdfTemplateListQuerySchema requires a trimmed category key", () => {
  assert.deepEqual(chungTuPdfTemplateListQuerySchema.parse({ categoryKey: " phieu-nhap-kho " }), {
    categoryKey: "phieu-nhap-kho",
    includeNonPublished: false,
  });
  assert.throws(() => chungTuPdfTemplateListQuerySchema.parse({ categoryKey: "   " }));
});

test("chungTuPdfTemplateListQuerySchema normalizes includeNonPublished", () => {
  assert.deepEqual(
    chungTuPdfTemplateListQuerySchema.parse({
      categoryKey: " phieu-nhap-kho ",
      includeNonPublished: "1",
    }),
    {
      categoryKey: "phieu-nhap-kho",
      includeNonPublished: true,
    },
  );
  assert.deepEqual(
    chungTuPdfTemplateListQuerySchema.parse({
      categoryKey: "phieu-nhap-kho",
      includeNonPublished: false,
    }),
    {
      categoryKey: "phieu-nhap-kho",
      includeNonPublished: false,
    },
  );
});

test("chungTuPdfTemplateIdParamSchema coerces numeric ids", () => {
  assert.deepEqual(chungTuPdfTemplateIdParamSchema.parse({ id: "42" }), { id: 42 });
});

test("chungTuPdfTemplateUploadBodySchema normalizes multipart fields", () => {
  assert.deepEqual(
    chungTuPdfTemplateUploadBodySchema.parse({
      categoryKey: " bang-ke-mua-hang ",
      displayName: " ",
      name: " bien-ban-test ",
      version: " v1 ",
    }),
    {
      categoryKey: "bang-ke-mua-hang",
      displayName: undefined,
      name: "bien-ban-test",
      version: "v1",
    },
  );
});

test("chungTuPdfExportCreateBodySchema uses the PDF category allowlist", () => {
  assert.deepEqual(
    chungTuPdfExportCreateBodySchema.parse({
      categoryKey: " phieu-nhap-kho ",
      unitId: "1",
      dateFrom: "2026-08-23",
      dateTo: "2026-08-23",
      pdfTemplateId: "2",
    }),
    {
      categoryKey: "phieu-nhap-kho",
      unitId: 1,
      dateFrom: "2026-08-23",
      dateTo: "2026-08-23",
      pdfTemplateId: 2,
      signatures: {},
      signatureDates: {},
    },
  );
  assert.throws(() =>
    chungTuPdfExportCreateBodySchema.parse({
      categoryKey: "unsupported-category",
      unitId: 1,
      dateFrom: "2026-08-23",
      dateTo: "2026-08-23",
      pdfTemplateId: 2,
    }),
  );
});

test("chungTuPdfExportCreateBodySchema requires date range for PNK", () => {
  assert.deepEqual(
    chungTuPdfExportCreateBodySchema.parse({
      categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
      unitId: "1",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-03",
      aggregationMode: "full",
      pdfTemplateId: "2",
    }),
    {
      categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
      unitId: 1,
      dateFrom: "2026-09-01",
      dateTo: "2026-09-03",
      aggregationMode: "full",
      pdfTemplateId: 2,
      signatures: {},
      signatureDates: {},
    },
  );
});

test("chungTuPdfExportCreateBodySchema rejects PNK without date range", () => {
  assert.throws(() =>
    chungTuPdfExportCreateBodySchema.parse({
      categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
      unitId: "1",
      periodMonth: "2026-09",
      pdfTemplateId: "2",
    }),
  );
});

test("chungTuPdfExportCreateBodySchema rejects unitIds and by-unit for PNK", () => {
  assert.throws(() =>
    chungTuPdfExportCreateBodySchema.parse({
      categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
      unitId: "1",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-03",
      aggregationMode: "by-unit",
      unitIds: [2, 3],
      pdfTemplateId: "2",
    }),
  );
});

test("chungTuPdfExportCreateBodySchema rejects reversed PNK date range", () => {
  assert.throws(() =>
    chungTuPdfExportCreateBodySchema.parse({
      categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
      unitId: "1",
      dateFrom: "2026-09-03",
      dateTo: "2026-09-01",
      pdfTemplateId: "2",
    }),
  );
});

test("chungTuPdfExportCreateBodySchema still requires unitIds for other monthly categories", () => {
  assert.throws(() =>
    chungTuPdfExportCreateBodySchema.parse({
      categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
      unitId: "1",
      periodMonth: "2026-09",
      pdfTemplateId: "2",
    }),
  );
});

test("chungTuBkmhHeaderSettingsPutBodySchema rejects non-string hoTenNguoiMua", () => {
  const base = { categoryKey: "bang-ke-mua-hang" };
  assert.throws(() =>
    chungTuBkmhHeaderSettingsPutBodySchema.parse({ ...base, hoTenNguoiMua: {} }),
  );
  assert.throws(() =>
    chungTuBkmhHeaderSettingsPutBodySchema.parse({ ...base, hoTenNguoiMua: ["x"] }),
  );
  assert.deepEqual(
    chungTuBkmhHeaderSettingsPutBodySchema.parse({ ...base, hoTenNguoiMua: "  " }),
    { ...base, hoTenNguoiMua: null },
  );
  assert.deepEqual(
    chungTuBkmhHeaderSettingsPutBodySchema.parse({ ...base, hoTenNguoiMua: " Nguyen Van A " }),
    { ...base, hoTenNguoiMua: "Nguyen Van A" },
  );
});
