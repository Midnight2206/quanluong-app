import { z } from "zod";

const templateIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const documentIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const signatureSlotSchema = z.object({
  key: z.string().min(1),
  label: z.string().default(""),
  col: z.coerce.number().int().min(0).default(0),
  col_span: z.coerce.number().int().positive().default(1),
  source: z.enum(["static", "dynamic"]).default("dynamic"),
  static_name: z.string().nullable().optional(),
  show_date_line: z.boolean().default(false),
});

const signatureBlockSchema = z.object({
  slots: z.array(signatureSlotSchema).min(1),
  columns: z.coerce.number().int().positive().default(2),
  gap_pt: z.coerce.number().positive().default(40),
  date_line_gap_pt: z.coerce.number().positive().default(14),
});

const renderDocumentBodySchema = z.object({
  fields: z.record(z.string(), z.unknown()).default({}),
  rows: z.array(z.record(z.string(), z.unknown())).default([]),
  signatures: z.record(z.string(), z.string()).default({}),
  signature_dates: z.record(z.string(), z.string()).default({}),
  signature_block: signatureBlockSchema.optional(),
});

const renderStoredPdfBodySchema = z.object({
  signatures: z.record(z.string(), z.string()).default({}),
  signature_dates: z.record(z.string(), z.string()).default({}),
  signature_block: signatureBlockSchema.optional(),
});

export {
  documentIdParamsSchema,
  renderDocumentBodySchema,
  renderStoredPdfBodySchema,
  templateIdParamsSchema,
};
