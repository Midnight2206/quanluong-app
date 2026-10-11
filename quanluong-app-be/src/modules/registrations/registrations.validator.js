import { z } from "zod";

const registrationUserParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

const rejectRegistrationBodySchema = z.object({
  note: z.string().max(500).optional(),
});

const approveRegistrationBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({
    lttpSupplierId: z.coerce.number().int().positive().optional(),
  }),
);

export { approveRegistrationBodySchema, rejectRegistrationBodySchema, registrationUserParamsSchema };
