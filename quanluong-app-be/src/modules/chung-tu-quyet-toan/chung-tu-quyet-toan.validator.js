import { z } from "zod";
import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";

/** Chỉ filter — `displayName` lấy từ multipart field (multer → req.body), tin cậy UTF-8 hơn query khi POST FormData */
const driveImportQuerySchema = z.object({
  targetFolder: z.enum(["template", "midnight"]).optional(),
});

const driveImportBodySchema = z.object({
  displayName: z.preprocess(
    (v) => (v == null ? "" : String(v).trim()),
    z.string().min(1, "Nhập tên loại chứng từ").max(200),
  ),
});

const driveFileIdParamsSchema = z.object({
  driveFileId: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

const chungTuPdfCategoryKeySchema = z.preprocess(
  (v) => (v == null ? "" : String(v).trim()),
  z.enum([
    CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
    CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
  ]),
);

const chungTuBooleanQueryFlagSchema = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .optional()
  .transform((v) => v === true || v === "true" || v === "1");

const chungTuPdfTemplateListQuerySchema = z
  .object({
    categoryKey: chungTuPdfCategoryKeySchema,
    includeNonPublished: chungTuBooleanQueryFlagSchema,
  })
  .transform(({ categoryKey, includeNonPublished }) => ({
    categoryKey,
    includeNonPublished: Boolean(includeNonPublished),
  }));

const chungTuPdfTemplateIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** multipart (multer): categoryKey + displayName + name + version */
const chungTuPdfTemplateUploadBodySchema = z.object({
  categoryKey: chungTuPdfCategoryKeySchema,
  displayName: z.preprocess(
    (v) => {
      if (v == null) {
        return undefined;
      }
      const value = String(v).trim();
      return value || undefined;
    },
    z.string().min(1).max(200).optional(),
  ),
  name: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().min(1).max(120)),
  version: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().min(1).max(64)),
});

const putTemplateFillRulesBodySchema = z
  .object({
    fillRules: z.unknown().optional(),
    displayName: z.union([z.string().max(200), z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fillRules !== undefined) {
      const v = data.fillRules;
      if (v == null || typeof v !== "object" || Array.isArray(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fillRules phải là object JSON (không phải mảng).",
          path: ["fillRules"],
        });
      }
    }
    if (data.fillRules === undefined && data.displayName === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cần có ít nhất fillRules hoặc displayName.",
      });
    }
  });

const templateCatalogQuerySchema = z.object({
  categoryKey: z.string().min(1).max(80).optional(),
});

const templateCatalogManageQuerySchema = z.object({
  categoryKey: z.string().min(1).max(80).optional(),
});

const templateCatalogIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const templateCatalogCreateBodySchema = z.object({
  categoryKey: z.string().min(1).max(80),
  displayName: z.string().min(1).max(200),
  linkUrl: z.string().min(1).max(4000),
  sortOrder: z.coerce.number().int().optional(),
});

/** multipart (multer): categoryKey + displayName (+ sortOrder tùy chọn) */
const templateCatalogUploadBodySchema = z.object({
  categoryKey: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().min(1).max(80)),
  displayName: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().min(1).max(200)),
  sortOrder: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().optional(),
  ),
});

const templateCatalogPatchBodySchema = z
  .object({
    displayName: z.string().min(1).max(200).optional(),
    linkUrl: z.string().min(1).max(4000).optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
    fillRules: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fillRules !== undefined) {
      const v = data.fillRules;
      if (v == null || typeof v !== "object" || Array.isArray(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fillRules phải là object JSON (không phải mảng).",
          path: ["fillRules"],
        });
      }
    }
    if (
      data.displayName === undefined &&
      data.linkUrl === undefined &&
      data.sortOrder === undefined &&
      data.isActive === undefined &&
      data.fillRules === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cần ít nhất một trường cập nhật.",
      });
    }
  });

const templateFieldRegistryQuerySchema = z.object({
  categoryKey: z.string().max(80).optional(),
});

const categoryKeyParamSchema = z.object({
  categoryKey: z.string().min(1).max(80),
});

const categoryTemplateDriveParamsSchema = z.object({
  categoryKey: z.string().min(1).max(80),
  driveFileId: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

const putCategoryTemplateFillMappingBodySchema = z
  .object({
    fillRules: z.unknown(),
  })
  .superRefine((data, ctx) => {
    const v = data.fillRules;
    if (v == null || typeof v !== "object" || Array.isArray(v)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fillRules phải là object JSON (không phải mảng).",
        path: ["fillRules"],
      });
    }
  });

const unitIdQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
});

const chungTuUnitProfilePutBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  donViCapTren: z.string().max(255).nullable().optional(),
  boPhan: z.string().max(255).nullable().optional(),
  quyenSo: z.string().max(32).nullable().optional(),
  noTaiKhoan: z.string().max(128).nullable().optional(),
  coTaiKhoan: z.string().max(128).nullable().optional(),
  signerLabelWriter: z.string().max(128).nullable().optional(),
  signerLabelApprover: z.string().max(128).nullable().optional(),
  signerLabelThird: z.string().max(128).nullable().optional(),
  signerWriter: z.string().max(191).nullable().optional(),
  signerApprover: z.string().max(191).nullable().optional(),
  signerThird: z.string().max(191).nullable().optional(),
  signerNguoiMua: z.string().max(191).nullable().optional(),
  signerPhuTrachBoPhan: z.string().max(191).nullable().optional(),
  signerTaiChinh: z.string().max(191).nullable().optional(),
});

const chungTuAggregationModeSchema = z.enum(["by-day", "by-unit", "full"]).optional();

const chungTuDocumentsListQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  categoryKey: z.string().min(1).max(80).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const documentKeyParamSchema = z.object({
  documentKey: z.string().min(8).max(200),
});

const chungTuDocumentBaseBodySchema = z.object({
  categoryKey: z.string().min(1).max(80),
  unitId: z.coerce.number().int().positive(),
  periodDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  periodMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  unitIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  aggregationMode: chungTuAggregationModeSchema,
  issueSlipId: z.coerce.number().int().positive().optional(),
  templateDriveFileId: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
  templateDisplayName: z.string().max(200).optional(),
  settings: z.record(z.unknown()).optional(),
});

function refineChungTuDocumentBody(data, ctx) {
  if (data.periodMonth) {
    if (!data.unitIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Chứng từ theo tháng cần chọn ít nhất một đơn vị (unitIds).",
        path: ["unitIds"],
      });
    }
    return;
  }
  if (data.categoryKey === "phieu-xuat-kho") {
    if (!data.issueSlipId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phiếu xuất kho cần issueSlipId.",
        path: ["issueSlipId"],
      });
    }
    return;
  }
  if (!data.periodDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Chứng từ theo ngày cần periodDate (YYYY-MM-DD).",
      path: ["periodDate"],
    });
  }
}

const chungTuDocumentCreateBodySchema = chungTuDocumentBaseBodySchema
  .extend({
    templateDriveFileId: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/),
  })
  .superRefine(refineChungTuDocumentBody);

const chungTuContextPreviewBodySchema = chungTuDocumentBaseBodySchema.superRefine(
  refineChungTuDocumentBody,
);

const chungTuPdfExportCreateBodySchema = chungTuDocumentBaseBodySchema
  .omit({
    templateDriveFileId: true,
    templateDisplayName: true,
  })
  .extend({
    categoryKey: chungTuPdfCategoryKeySchema,
    pdfTemplateId: z.coerce.number().int().positive(),
    signatures: z.record(z.string()).optional().default({}),
    signatureDates: z.record(z.string()).optional().default({}),
    signatureBlock: z.record(z.unknown()).optional(),
  })
  .superRefine(refineChungTuDocumentBody);

const chungTuPdfExportBatchCreateBodySchema = chungTuPdfExportCreateBodySchema;

const chungTuPdfExportKeyParamSchema = z.object({
  exportKey: z.string().min(8).max(200),
});

const chungTuPdfExportBatchListQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  categoryKey: chungTuPdfCategoryKeySchema.optional(),
});

const chungTuPdfExportBatchKeyParamSchema = z.object({
  batchKey: z.string().min(8).max(200),
});

const chungTuPdfExportBatchFileParamsSchema = z.object({
  batchKey: z.string().min(8).max(200),
  fileId: z.coerce.number().int().positive(),
});

const chungTuSignatureSettingsQuerySchema = z.object({
  categoryKey: chungTuPdfCategoryKeySchema,
});

const chungTuSignatureSettingsPutBodySchema = z.object({
  categoryKey: chungTuPdfCategoryKeySchema,
  signatureBlock: z.record(z.unknown()),
});

const templateTreeQuerySchema = z.object({
  folderId: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
  categoryKey: z.string().min(1).max(80).optional(),
});

const templateTreeFileParamsSchema = z.object({
  driveFileId: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export {
  driveImportBodySchema,
  driveImportQuerySchema,
  driveFileIdParamsSchema,
  chungTuPdfTemplateIdParamSchema,
  chungTuPdfTemplateListQuerySchema,
  chungTuPdfTemplateUploadBodySchema,
  templateCatalogCreateBodySchema,
  templateCatalogUploadBodySchema,
  templateCatalogIdParamSchema,
  templateCatalogManageQuerySchema,
  templateCatalogPatchBodySchema,
  templateCatalogQuerySchema,
  templateFieldRegistryQuerySchema,
  putTemplateFillRulesBodySchema,
  categoryKeyParamSchema,
  categoryTemplateDriveParamsSchema,
  putCategoryTemplateFillMappingBodySchema,
  unitIdQuerySchema,
  chungTuUnitProfilePutBodySchema,
  chungTuDocumentsListQuerySchema,
  documentKeyParamSchema,
  chungTuDocumentCreateBodySchema,
  chungTuContextPreviewBodySchema,
  chungTuPdfExportCreateBodySchema,
  chungTuPdfExportBatchCreateBodySchema,
  chungTuPdfExportKeyParamSchema,
  chungTuPdfExportBatchListQuerySchema,
  chungTuPdfExportBatchKeyParamSchema,
  chungTuPdfExportBatchFileParamsSchema,
  chungTuSignatureSettingsQuerySchema,
  chungTuSignatureSettingsPutBodySchema,
  templateTreeQuerySchema,
  templateTreeFileParamsSchema,
};
