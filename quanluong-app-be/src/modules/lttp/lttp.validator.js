import { z } from "zod";

const idParam = z.coerce.number().int().positive();

const commodityQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
});

const commodityParamsSchema = z.object({
  id: idParam,
});

const createCommodityBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  measureUnit: z.string().min(1).max(64),
  /** Bỏ trống / không gửi → nhóm mặc định «Khác» (other) */
  groupId: z.coerce.number().int().positive().optional().nullable(),
  conversionRate: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().finite().optional().nullable(),
  ),
  isActive: z.boolean().optional(),
});

const patchCommodityBodySchema = z.object({
  code: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(255).optional(),
  measureUnit: z.string().min(1).max(64).optional(),
  groupId: z.coerce.number().int().positive().optional().nullable(),
  conversionRate: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().finite().optional().nullable(),
  ),
  isActive: z.boolean().optional(),
});

const priceRowSchema = z.object({
  commodityId: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().finite(),
  tgsxPrice: z.coerce.number().finite().optional().nullable(),
});

const createPriceTableBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  note: z.string().max(500).optional().nullable(),
  rows: z.array(priceRowSchema).min(1),
});

const patchPriceTableBodySchema = z
  .object({
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    note: z.string().max(500).optional().nullable(),
    rows: z.array(priceRowSchema).min(1).optional(),
  })
  .refine((o) => o.effectiveDate !== undefined || o.note !== undefined || o.rows !== undefined, {
    message: "Cần ít nhất một trường cập nhật",
  });

const effectiveQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

const listPriceTablesQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const priceTableParamsSchema = z.object({
  id: idParam,
});

const foodGroupIdParamsSchema = z.object({
  id: idParam,
});

const createFoodGroupBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(191),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

const patchFoodGroupBodySchema = z
  .object({
    code: z.string().min(1).max(64).optional(),
    name: z.string().min(1).max(191).optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => o.code !== undefined || o.name !== undefined || o.sortOrder !== undefined || o.isActive !== undefined, {
    message: "Cần ít nhất một trường cập nhật",
  });

const applyLttpToUnitBodySchema = z
  .object({
    targetUnitId: z.coerce.number().int().positive().optional(),
    targetUnitIds: z.array(z.coerce.number().int().positive()).min(1).max(100).optional(),
  })
  .superRefine((val, ctx) => {
    const one = val.targetUnitId != null;
    const many = val.targetUnitIds != null && val.targetUnitIds.length > 0;
    if (one === many) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cần đúng một trong hai: targetUnitId hoặc targetUnitIds.",
      });
    }
  });

/** Giống `applyLttpToUnitBodySchema` + ngày hiệu lực bản ghi đích (đơn vị con), optional — mặc định theo bảng nguồn. */
const applyLttpPriceTableToUnitBodySchema = z
  .object({
    targetUnitId: z.coerce.number().int().positive().optional(),
    targetUnitIds: z.array(z.coerce.number().int().positive()).min(1).max(100).optional(),
    targetEffectiveDate: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    ),
  })
  .superRefine((val, ctx) => {
    const one = val.targetUnitId != null;
    const many = val.targetUnitIds != null && val.targetUnitIds.length > 0;
    if (one === many) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cần đúng một trong hai: targetUnitId hoặc targetUnitIds.",
      });
    }
  });

export {
  applyLttpPriceTableToUnitBodySchema,
  applyLttpToUnitBodySchema,
  commodityParamsSchema,
  commodityQuerySchema,
  createCommodityBodySchema,
  createFoodGroupBodySchema,
  createPriceTableBodySchema,
  effectiveQuerySchema,
  listPriceTablesQuerySchema,
  patchCommodityBodySchema,
  patchFoodGroupBodySchema,
  patchPriceTableBodySchema,
  foodGroupIdParamsSchema,
  priceTableParamsSchema,
};
