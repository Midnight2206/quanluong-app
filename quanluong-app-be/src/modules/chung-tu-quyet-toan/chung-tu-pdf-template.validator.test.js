import assert from "node:assert/strict";
import test from "node:test";

import {
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
      periodDate: "2026-08-23",
      pdfTemplateId: "2",
    }),
    {
      categoryKey: "phieu-nhap-kho",
      unitId: 1,
      periodDate: "2026-08-23",
      pdfTemplateId: 2,
      signatures: {},
      signatureDates: {},
    },
  );
  assert.throws(() =>
    chungTuPdfExportCreateBodySchema.parse({
      categoryKey: "unsupported-category",
      unitId: 1,
      periodDate: "2026-08-23",
      pdfTemplateId: 2,
    }),
  );
});
