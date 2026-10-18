import { z } from "zod";
import { BA_DOC_KEYS, BA_EVIDENCE, BA_RULE_STATUSES, CHUNG_ID_RE, RIENG_ID_RE } from "./ba-profiles.utils.js";

const ruleIdSchema = z
  .string()
  .trim()
  .refine((v) => CHUNG_ID_RE.test(v) || RIENG_ID_RE.test(v), "ruleId phải dạng CHUNG-xx hoặc RIENG-xx");

const ruleSchema = z.object({
  ruleId: ruleIdSchema,
  status: z.enum(BA_RULE_STATUSES),
  note: z.string().trim().max(2000).optional().nullable(),
  evidence: z.enum(BA_EVIDENCE).optional().nullable(),
});

const pushProfileBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  contentMarkdown: z.string().min(1),
  schemaVersion: z.string().trim().min(1).max(32).default("ba-kit-v1"),
  sourceAgentName: z.string().trim().max(120).optional().nullable(),
  rules: z
    .array(ruleSchema)
    .max(500)
    .optional()
    .refine((rules) => !rules || new Set(rules.map((r) => r.ruleId)).size === rules.length, "ruleId bị trùng"),
});

const docKeyParamsSchema = z.object({ docKey: z.enum(BA_DOC_KEYS) });

const baselineQuerySchema = z.object({ version: z.coerce.number().int().positive().optional() });

const publishBaselineBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  contentMarkdown: z.string().min(1),
});

const createProposalBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).optional().nullable(),
  relatedRuleIds: z.array(ruleIdSchema).max(50).default([]),
  proposedText: z.string().trim().min(1).max(20000),
});

const listProposalsQuerySchema = z.object({
  status: z.enum(["OPEN", "ACCEPTED", "REJECTED"]).optional(),
});

const reviewProposalBodySchema = z.object({
  status: z.enum(["OPEN", "ACCEPTED", "REJECTED"]),
  reviewComment: z.string().trim().max(10000).optional().nullable(),
});

const listProfilesQuerySchema = z.object({
  latest: z.enum(["1", "true"]).optional(),
  unitId: z.coerce.number().int().positive().optional(),
});

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

const createTokenBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  scope: z.enum(["UNIT_PUSH", "GLOBAL_READ", "GLOBAL_WRITE"]).default("UNIT_PUSH"),
});

export {
  baselineQuerySchema,
  createProposalBodySchema,
  createTokenBodySchema,
  docKeyParamsSchema,
  idParamsSchema,
  listProfilesQuerySchema,
  listProposalsQuerySchema,
  publishBaselineBodySchema,
  pushProfileBodySchema,
  reviewProposalBodySchema,
};
