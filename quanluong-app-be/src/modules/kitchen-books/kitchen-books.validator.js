import { z } from "zod";

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "yearMonth dạng YYYY-MM");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date dạng YYYY-MM-DD");
const mealPeriodSchema = z.enum(["sang", "trua", "chieu"]);
const calcModeSchema = z.enum(["per_person", "per_unit_shared"]);
const perPersonUnitSchema = z.enum(["g", "ml"]);

const unitIdQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
});

const catalogListQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const catalogIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const catalogIdQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
});

const lineInputSchema = z
  .object({
    commodityId: z.coerce.number().int().positive(),
    calcMode: calcModeSchema,
    perPersonAmount: z.coerce.number().positive().optional().nullable(),
    perPersonUnit: perPersonUnitSchema.optional().nullable(),
    peoplePerUnit: z.coerce.number().positive().optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((o, ctx) => {
    if (o.calcMode === "per_person") {
      if (o.perPersonAmount == null || o.perPersonUnit == null) {
        ctx.addIssue({ code: "custom", message: "per_person cần perPersonAmount và perPersonUnit" });
      }
    }
    if (o.calcMode === "per_unit_shared" && o.peoplePerUnit == null) {
      ctx.addIssue({ code: "custom", message: "per_unit_shared cần peoplePerUnit" });
    }
  });

const createCatalogBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(300),
  note: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  lines: z.array(lineInputSchema).min(1),
});

const updateCatalogBodySchema = z
  .object({
    unitId: z.coerce.number().int().positive(),
    name: z.string().trim().min(1).max(300).optional(),
    note: z.string().trim().max(500).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    lines: z.array(lineInputSchema).min(1).optional(),
  })
  .refine((o) => Object.keys(o).length > 1, { message: "Cần ít nhất một trường cập nhật" });

const menuQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  date: dateSchema,
});

const monthMarkersQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  yearMonth: yearMonthSchema,
});

const dishInputSchema = z.object({
  name: z.string().trim().min(1).max(300),
  sortOrder: z.coerce.number().int().min(0).optional(),
  sourceCatalogId: z.coerce.number().int().positive().optional().nullable(),
  lines: z.array(lineInputSchema).default([]),
});

const putMenuBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  date: dateSchema,
  mealPeriod: mealPeriodSchema,
  note: z.string().trim().max(500).optional().nullable(),
  dishes: z.array(dishInputSchema).default([]),
});

const importCatalogBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  date: dateSchema,
  mealPeriod: mealPeriodSchema,
  catalogId: z.coerce.number().int().positive(),
});

const dishIdParamsSchema = z.object({
  dishId: z.coerce.number().int().positive(),
});

const deleteDishQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
});

export {
  catalogListQuerySchema,
  catalogIdParamsSchema,
  catalogIdQuerySchema,
  createCatalogBodySchema,
  updateCatalogBodySchema,
  menuQuerySchema,
  monthMarkersQuerySchema,
  putMenuBodySchema,
  importCatalogBodySchema,
  dishIdParamsSchema,
  deleteDishQuerySchema,
  unitIdQuerySchema,
};
