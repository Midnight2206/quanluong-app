import { z } from "zod";

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "yearMonth dạng YYYY-MM");

const unitIdQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
});

const metaQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  yearMonth: yearMonthSchema.optional(),
});

const listQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  yearMonth: yearMonthSchema,
});

const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  yearMonth: yearMonthSchema,
  fullName: z.string().trim().min(1).max(255),
  rank: z
    .string()
    .max(128)
    .optional()
    .transform((v) => (v == null ? "" : String(v).trim())),
  mealAllowanceRateId: z.coerce.number().int().positive(),
  unitDisplay: z.string().trim().min(1).max(255),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

const patchBodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(255).optional(),
    rank: z.string().trim().max(128).optional(),
    mealAllowanceRateId: z.coerce.number().int().positive().optional(),
    unitDisplay: z.string().trim().min(1).max(255).optional(),
    sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Cần ít nhất một trường cập nhật" });

const copyPreviousBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  yearMonth: yearMonthSchema,
});

const importBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  yearMonth: yearMonthSchema,
});

const periodAmountsBodySchema = z.object({
  sang: z.coerce.number().int().min(0),
  trua: z.coerce.number().int().min(0),
  chieu: z.coerce.number().int().min(0),
});

const mealRateSelectionRowSchema = z.object({
  mealAllowanceRateId: z.coerce.number().int().positive(),
  periodAmounts: periodAmountsBodySchema.optional(),
});

const putSelectedRatesBodySchema = z
  .object({
    unitId: z.coerce.number().int().positive(),
    /// Ngày bắt đầu áp dụng tỉ lệ S/T/C mới (YYYY-MM-DD); mặc định server: hôm nay nếu không gửi.
    periodSplitValidFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "periodSplitValidFrom dạng YYYY-MM-DD")
      .optional(),
    mealAllowanceRateIds: z.array(z.coerce.number().int().positive()).optional(),
    selections: z.array(mealRateSelectionRowSchema).optional(),
  })
  .superRefine((o, ctx) => {
    const hasSel = Array.isArray(o.selections) && o.selections.length > 0;
    const hasIds = Array.isArray(o.mealAllowanceRateIds) && o.mealAllowanceRateIds.length > 0;
    if (!hasSel && !hasIds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cần selections hoặc mealAllowanceRateIds (ít nhất một mức)",
        path: ["selections"],
      });
    }
  });

const mealPeriodSchema = z.enum(["sang", "trua", "chieu"]);

const dayMarkRowSchema = z.object({
  mealRosterEntryId: z.coerce.number().int().positive(),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  mealPeriod: mealPeriodSchema,
  mealAllowanceRateId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
});

const extraDayMarkRowSchema = z.object({
  mealRosterEntryId: z.coerce.number().int().positive(),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  mealAllowanceRateId: z.coerce.number().int().positive(),
});

const extraSplitRowSchema = z
  .object({
    dayOfMonth: z.coerce.number().int().min(1).max(31),
    periods: z.array(mealPeriodSchema).min(1).max(3),
  })
  .refine((o) => new Set(o.periods).size === o.periods.length, {
    message: "periods không được trùng buổi",
  });

const replaceDayMarksBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  yearMonth: yearMonthSchema,
  marks: z.array(dayMarkRowSchema),
  extraMarks: z.array(extraDayMarkRowSchema).optional().default([]),
  extraSplits: z.array(extraSplitRowSchema).optional().default([]),
});

export {
  copyPreviousBodySchema,
  createBodySchema,
  dayMarkRowSchema,
  extraDayMarkRowSchema,
  extraSplitRowSchema,
  mealPeriodSchema,
  mealRateSelectionRowSchema,
  metaQuerySchema,
  idParamsSchema,
  importBodySchema,
  listQuerySchema,
  patchBodySchema,
  periodAmountsBodySchema,
  putSelectedRatesBodySchema,
  replaceDayMarksBodySchema,
  unitIdQuerySchema,
};
