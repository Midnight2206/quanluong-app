import { z } from "zod";

const depthParamsSchema = z.object({
  depth: z.coerce.number().int().min(0).max(30),
});

const replaceCapsBodySchema = z.object({
  permissionIds: z.array(z.coerce.number().int().positive()).max(500),
});

export { depthParamsSchema, replaceCapsBodySchema };
