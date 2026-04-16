import { z } from "zod";

const createUnitBodySchema = z.object({
  name: z.string().min(1).max(191),
  description: z.string().max(5000).optional().nullable(),
  parentId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

const patchUnitBodySchema = createUnitBodySchema.partial();

const unitParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const listPrivateDataSharesQuerySchema = z.object({
  ownerUnitId: z.coerce.number().int().positive(),
});

const createPrivateDataShareBodySchema = z.object({
  ownerUnitId: z.coerce.number().int().positive(),
  consumerUnitIds: z.array(z.coerce.number().int().positive()).min(1),
  dataKind: z.string().min(1).max(64),
  /** null / bỏ qua = áp dụng cho toàn bộ dữ liệu loại đó từ kho đơn vị chủ. */
  recordId: z.coerce.number().int().positive().optional().nullable(),
  validFrom: z.coerce.date().optional(),
});

const grantRevokeParamsSchema = z.object({
  grantId: z.coerce.number().int().positive(),
});

export {
  createPrivateDataShareBodySchema,
  createUnitBodySchema,
  grantRevokeParamsSchema,
  listPrivateDataSharesQuerySchema,
  patchUnitBodySchema,
  unitParamsSchema,
};
