import { z } from "zod";

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.email(),
  password: z.string().min(8),
});
