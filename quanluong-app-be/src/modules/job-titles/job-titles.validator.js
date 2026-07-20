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

export {
  createJobTitleBodySchema,
  jobTitleParamsSchema,
  patchJobTitleBodySchema,
  setJobTitlePermissionsBodySchema,
};
