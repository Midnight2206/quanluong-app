import { z } from "zod";

const depthParamsSchema = z.object({
  depth: z.coerce.number().int().min(0).max(20),
});

const upsertUnitLevelBodySchema = z.object({
  label: z.string().max(191).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
});

export { depthParamsSchema, upsertUnitLevelBodySchema };
