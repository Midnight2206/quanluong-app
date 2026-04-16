import { z } from "zod";

const createJobTitleBodySchema = z.object({
  unitId: z.number().int().positive(),
  name: z.string().min(1).max(191),
  description: z.string().max(5000).optional().nullable(),
  isActive: z.boolean().optional(),
});

const patchJobTitleBodySchema = createJobTitleBodySchema.partial().omit({ unitId: true });

const jobTitleParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const setJobTitlePermissionsBodySchema = z.object({
  permissionIds: z.array(z.number().int().positive()),
});

const applyJobTitleToUnitBodySchema = z
  .object({
    targetUnitId: z.number().int().positive().optional(),
    targetUnitIds: z.array(z.number().int().positive()).min(1).max(100).optional(),
  })
  .superRefine((val, ctx) => {
    const one = val.targetUnitId != null;
    const many = val.targetUnitIds != null && val.targetUnitIds.length > 0;
    if (one === many) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cần đúng một trong hai: targetUnitId hoặc targetUnitIds (mảng id đơn vị con).",
      });
    }
  });

export {
  applyJobTitleToUnitBodySchema,
  createJobTitleBodySchema,
  jobTitleParamsSchema,
  patchJobTitleBodySchema,
  setJobTitlePermissionsBodySchema,
};
