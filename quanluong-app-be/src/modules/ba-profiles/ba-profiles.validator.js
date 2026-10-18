import { z } from "zod";

const pushProfileBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  contentMarkdown: z.string().min(1),
  schemaVersion: z.string().trim().min(1).max(32).default("ba-kit-v1"),
  sourceAgentName: z.string().trim().max(120).optional().nullable(),
});

const listProfilesQuerySchema = z.object({
  latest: z.enum(["1", "true"]).optional(),
  unitId: z.coerce.number().int().positive().optional(),
});

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

const createTokenBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  scope: z.enum(["UNIT_PUSH", "GLOBAL_READ"]).default("UNIT_PUSH"),
});

export { createTokenBodySchema, idParamsSchema, listProfilesQuerySchema, pushProfileBodySchema };
