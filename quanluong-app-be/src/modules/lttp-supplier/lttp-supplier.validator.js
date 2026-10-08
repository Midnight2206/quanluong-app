import { z } from "zod";

const ordersQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplierId: z.coerce.number().int().positive(),
});

const userLinksParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export { ordersQuerySchema, userLinksParamsSchema };
