import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optInt = z.coerce.number().int().positive().optional();

const baseQuery = {
  from: dateStr.optional(),
  to: dateStr.optional(),
  userId: optInt,
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
};

const authQuerySchema = z.object({
  ...baseQuery,
  type: z.enum(["LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT"]).optional(),
});

export { authQuerySchema, baseQuery, dateStr };
