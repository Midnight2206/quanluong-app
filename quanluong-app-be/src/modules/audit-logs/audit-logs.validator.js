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

const changesQuerySchema = z.object({
  ...baseQuery,
  action: z.enum(["CREATE", "UPDATE", "DELETE"]).optional(),
  model: z.string().regex(/^[A-Za-z]{1,64}$/).optional(),
  recordId: z.string().max(191).optional(),
});

const usageQuerySchema = z.object({ ...baseQuery, cursor: z.string().regex(/^\d+$/).optional(), source: z.enum(["web", "supplier"]).optional() });

const usagePagesQuerySchema = z.object({
  userId: z.coerce.number().int().positive(),
  day: dateStr,
  kind: z.enum(["PAGE_VIEW", "ACTION"]).optional(),
  source: z.enum(["web", "supplier"]).optional(),
});

const usageBatchBodySchema = z.object({
  events: z
    .array(
      z.object({
        kind: z.enum(["PAGE_VIEW", "HEARTBEAT", "ACTION"]),
        path: z.string().max(1000),
        label: z.string().max(128).optional(),
        at: z.string().max(40).optional(),
        sec: z.number().min(0).max(600).optional(),
      }),
    )
    .max(50),
});

const exportParamsSchema = z.object({ tab: z.enum(["auth", "changes", "usage"]) });

const idParamsSchema = z.object({ id: z.string().regex(/^\d+$/) });

export { exportParamsSchema, authQuerySchema, baseQuery, changesQuerySchema, dateStr, idParamsSchema, usageBatchBodySchema, usagePagesQuerySchema, usageQuerySchema };
