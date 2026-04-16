import { z } from "zod";

const permissionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const patchPermissionBodySchema = z.object({
  description: z.string().max(10000).nullable(),
});

export { patchPermissionBodySchema, permissionIdParamsSchema };
