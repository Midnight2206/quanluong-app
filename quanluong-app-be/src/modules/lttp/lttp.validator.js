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
  partnerUnitPrice: z.coerce.number().finite().optional().nullable(),
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

const issueSlipLineInputSchema = z.object({
  commodityId: z.coerce.number().int().positive(),
  requiredQuantity: z.coerce.number().finite().nonnegative().nullable().optional(),
  quantity: z.coerce.number().finite().positive(),
  lttpSupplierId: z.coerce.number().int().positive(),
  lineNote: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.union([z.string().max(500), z.null()]).optional(),
  ),
});

const createIssueSlipBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  note: z.string().max(500).optional().nullable(),
  lines: z.array(issueSlipLineInputSchema).min(1).max(500),
  recipientUnitId: z.coerce.number().int().positive().optional().nullable(),
  recipientUserId: z.coerce.number().int().positive().optional().nullable(),
  recipientDisplayName: z.string().max(191).optional().nullable(),
  printLine1: z.string().max(255).optional().nullable(),
  printLine2: z.string().max(128).optional().nullable(),
  formMauSo: z.string().max(64).optional().nullable(),
  warehouseFrom: z.string().max(128).optional().nullable(),
  signerWriter: z.string().max(191).optional().nullable(),
  signerRecipient: z.string().max(191).optional().nullable(),
  signerApprover: z.string().max(191).optional().nullable(),
  buyerUserId: z.coerce.number().int().positive().optional().nullable(),
  buyerDisplayName: z.string().max(191).optional().nullable(),
});

const updateIssueSlipBodySchema = z.object({
  note: z.string().max(500).optional().nullable(),
  lines: z.array(issueSlipLineInputSchema).min(1).max(500),
  recipientUnitId: z.coerce.number().int().positive().optional().nullable(),
  recipientUserId: z.coerce.number().int().positive().optional().nullable(),
  recipientDisplayName: z.string().max(191).optional().nullable(),
  printLine1: z.string().max(255).optional().nullable(),
  printLine2: z.string().max(128).optional().nullable(),
  formMauSo: z.string().max(64).optional().nullable(),
  warehouseFrom: z.string().max(128).optional().nullable(),
  signerWriter: z.string().max(191).optional().nullable(),
  signerRecipient: z.string().max(191).optional().nullable(),
  signerApprover: z.string().max(191).optional().nullable(),
  buyerUserId: z.coerce.number().int().positive().optional().nullable(),
  buyerDisplayName: z.string().max(191).optional().nullable(),
});

const listIssueSlipsQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  from: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    )
    .optional(),
  to: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    )
    .optional(),
  recipientUnitId: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z.coerce.number().int().positive().optional(),
    )
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const issueSlipResolveQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  code: z.string().min(1).max(64),
});

const issueSlipIdParamsSchema = z.object({
  id: idParam,
});

const issueSlipPrintBatchBodySchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(80),
});

const nextIssueSlipSerialQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

/** `all` | `none` (không chọn đối tác trên dòng) | id đối tác kho đang chọn. */
const dailyOrderSummaryQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  supplierFilter: z
    .preprocess((v) => {
      if (v === "" || v === undefined || v === null) return "all";
      if (typeof v === "string") {
        const t = v.trim().toLowerCase();
        if (t === "" || t === "all") return "all";
        if (t === "none") return "none";
        const n = Number(v);
        if (Number.isInteger(n) && n > 0) return n;
      }
      if (typeof v === "number" && Number.isInteger(v) && v > 0) return v;
      return "all";
    }, z.union([z.literal("all"), z.literal("none"), z.number().int().positive()])),
});

const issueFormDefaultsQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
});

const upsertIssueFormDefaultsBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  printLine1: z.string().max(255).optional().nullable(),
  printLine2: z.string().max(128).optional().nullable(),
  formMauSo: z.string().max(64).optional().nullable(),
  warehouseFrom: z.string().max(128).optional().nullable(),
  marginTopCm: z.coerce.number().finite().min(0).max(10).optional().nullable(),
  marginRightCm: z.coerce.number().finite().min(0).max(10).optional().nullable(),
  marginBottomCm: z.coerce.number().finite().min(0).max(10).optional().nullable(),
  marginLeftCm: z.coerce.number().finite().min(0).max(10).optional().nullable(),
  printFontId: z.string().max(32).optional().nullable(),
  printFontSizePt: z.coerce.number().finite().min(8).max(18).optional().nullable(),
  signerWriter: z.string().max(191).optional().nullable(),
  signerApprover: z.string().max(191).optional().nullable(),
  defaultRecipientUnitId: z.coerce.number().int().positive().optional().nullable(),
  defaultRecipientUserId: z.coerce.number().int().positive().optional().nullable(),
  defaultBuyerUserId: z.coerce.number().int().positive().optional().nullable(),
});

const listRecipientUsersQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
});

const listBuyerUsersQuerySchema = listRecipientUsersQuerySchema;

const recipientDefaultByUnitQuerySchema = z.object({
  recipientUnitId: z.coerce.number().int().positive(),
});

const putRecipientDefaultUserBodySchema = z.object({
  recipientUnitId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

const putBuyerDefaultUserBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive().optional().nullable(),
  /** Mặc định true: gán người mua cho mọi phiếu xuất của đơn vị kho. */
  applyToAllSlips: z.boolean().optional().default(true),
});

const lttpSupplierQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
});

const putLttpCommodityDefaultSupplierBodySchema = z.object({
  lttpSupplierId: z.coerce.number().int().positive().optional().nullable(),
});

const lttpSupplierParamsSchema = z.object({
  id: idParam,
});

const createLttpSupplierBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  name: z.string().min(1).max(255),
  representativeName: z.string().min(1).max(255),
  address: z.string().max(500).optional().nullable(),
  businessLicenseNo: z.string().max(64).optional().nullable(),
  taxCode: z.string().max(32).optional().nullable(),
});

const patchLttpSupplierBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  representativeName: z.string().min(1).max(255).optional(),
  address: z.string().max(500).optional().nullable(),
  businessLicenseNo: z.string().max(64).optional().nullable(),
  taxCode: z.string().max(32).optional().nullable(),
});

export {
  applyLttpPriceTableToUnitBodySchema,
  applyLttpToUnitBodySchema,
  commodityParamsSchema,
  commodityQuerySchema,
  createCommodityBodySchema,
  createFoodGroupBodySchema,
  dailyOrderSummaryQuerySchema,
  createIssueSlipBodySchema,
  createPriceTableBodySchema,
  effectiveQuerySchema,
  issueSlipIdParamsSchema,
  issueSlipPrintBatchBodySchema,
  issueFormDefaultsQuerySchema,
  issueSlipResolveQuerySchema,
  listIssueSlipsQuerySchema,
  lttpSupplierQuerySchema,
  putLttpCommodityDefaultSupplierBodySchema,
  lttpSupplierParamsSchema,
  createLttpSupplierBodySchema,
  patchLttpSupplierBodySchema,
  listRecipientUsersQuerySchema,
  listBuyerUsersQuerySchema,
  nextIssueSlipSerialQuerySchema,
  listPriceTablesQuerySchema,
  patchCommodityBodySchema,
  patchFoodGroupBodySchema,
  patchPriceTableBodySchema,
  foodGroupIdParamsSchema,
  priceTableParamsSchema,
  putRecipientDefaultUserBodySchema,
  putBuyerDefaultUserBodySchema,
  recipientDefaultByUnitQuerySchema,
  updateIssueSlipBodySchema,
  upsertIssueFormDefaultsBodySchema,
};
