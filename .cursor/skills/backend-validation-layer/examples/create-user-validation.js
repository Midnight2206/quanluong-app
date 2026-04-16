import { z } from "zod";

import { validateRequest } from "../templates/validate-request";

const createUserBodySchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const validateCreateUser = validateRequest({
  bodySchema: createUserBodySchema,
});
