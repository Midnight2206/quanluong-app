import { z } from "zod";

const mealAllowanceRateTypeSchema = z.enum(["an_tieu_chuan", "an_them"]);

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createMealAllowanceRateBodySchema = z.object({
  doiTuong: z.string().min(1).max(65_000),
  mucTienAn: z.coerce.number().int().min(0).max(999_999_999),
  type: mealAllowanceRateTypeSchema,
  sortOrder: z.coerce.number().int().optional().default(0),
});

const patchMealAllowanceRateBodySchema = z
  .object({
    doiTuong: z.string().min(1).max(65_000).optional(),
    mucTienAn: z.coerce.number().int().min(0).max(999_999_999).optional(),
    type: mealAllowanceRateTypeSchema.optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine((o) => o.doiTuong !== undefined || o.mucTienAn !== undefined || o.type !== undefined || o.sortOrder !== undefined, {
    message: "Cần ít nhất một trường cập nhật",
  });

export {
  createMealAllowanceRateBodySchema,
  idParamSchema,
  patchMealAllowanceRateBodySchema,
};
