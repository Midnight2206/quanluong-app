import { z } from "zod";

const registrationUserParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

const rejectRegistrationBodySchema = z.object({
  note: z.string().max(500).optional(),
});

export { rejectRegistrationBodySchema, registrationUserParamsSchema };
