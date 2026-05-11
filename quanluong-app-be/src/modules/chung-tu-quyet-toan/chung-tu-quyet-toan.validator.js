import { z } from "zod";

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

export {
  driveImportBodySchema,
  driveImportQuerySchema,
  driveFileIdParamsSchema,
  templateCatalogCreateBodySchema,
  templateCatalogUploadBodySchema,
  templateCatalogIdParamSchema,
  templateCatalogManageQuerySchema,
  templateCatalogPatchBodySchema,
  templateCatalogQuerySchema,
  templateFieldRegistryQuerySchema,
  putTemplateFillRulesBodySchema,
};
