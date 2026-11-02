import { z } from "zod";
import { headcountSchema } from "./kitchen-ledger.validator.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date dạng YYYY-MM-DD");
const unitIdSchema = z.coerce.number().int().positive();

const assistantQuerySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
});

const assistantTurnBodySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
  text: z.string().max(20_000).optional(),
  imageBase64: z.string().max(6_000_000).optional(),
  imageMime: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  intent: z.enum(["headcount", "movement", "rule", "question"]).optional(),
  ruleTitle: z.string().max(120).optional(),
}).refine((value) => Boolean(value.text?.trim()) || Boolean(value.imageBase64), {
  message: "Nhập nội dung hoặc chọn ảnh.",
}).refine((value) => !value.imageBase64 || value.imageMime, {
  message: "Thiếu loại ảnh.",
});

const assistantApplyBodySchema = z.object({
  unitId: unitIdSchema,
  messageId: z.coerce.number().int().positive(),
  headcountDays: z.array(z.object({
    date: dateSchema,
    headcount: headcountSchema,
  })).max(31).optional(),
  movementLines: z.array(z.object({
    name: z.string().min(1).max(255),
    qty: z.coerce.number().positive().max(1_000_000_000),
    unitPrice: z.coerce.number().nonnegative().max(1_000_000_000_000).nullable().optional(),
  })).max(40).optional(),
  acceptProposals: z.boolean().optional(),
  schedules: z.array(z.object({
    date: dateSchema,
    text: z.string().trim().min(1).max(2000),
  })).max(31).optional(),
});

const assistantProfileBodySchema = z.object({
  unitId: unitIdSchema,
  displayName: z.string().trim().min(1).max(40),
  tone: z.enum(["ngan_gon", "than_mat"]),
  preferences: z.object({
    preferredInput: z.enum(["text", "photo", "either"]).optional(),
    suggestThreshold: z.coerce.number().positive().max(1_000_000_000).nullable().optional(),
  }).optional(),
});

const assistantMemoryBodySchema = z.object({
  unitId: unitIdSchema,
  fact: z.string().trim().min(1).max(240),
});

const assistantMemoryDeleteSchema = z.object({
  unitId: unitIdSchema,
  id: z.coerce.number().int().positive(),
});

const assistantRuleDeleteSchema = assistantMemoryDeleteSchema;

export {
  assistantApplyBodySchema,
  assistantMemoryBodySchema,
  assistantMemoryDeleteSchema,
  assistantProfileBodySchema,
  assistantQuerySchema,
  assistantRuleDeleteSchema,
  assistantTurnBodySchema,
};
