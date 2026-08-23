import assert from "node:assert/strict";
import test from "node:test";

import {
  chungTuPdfTemplateIdParamSchema,
  chungTuPdfTemplateListQuerySchema,
  chungTuPdfTemplateUploadBodySchema,
} from "./chung-tu-quyet-toan.validator.js";

test("chungTuPdfTemplateListQuerySchema requires a trimmed category key", () => {
  assert.deepEqual(chungTuPdfTemplateListQuerySchema.parse({ categoryKey: " phieu-nhap-kho " }), {
    categoryKey: "phieu-nhap-kho",
  });
  assert.throws(() => chungTuPdfTemplateListQuerySchema.parse({ categoryKey: "   " }));
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
