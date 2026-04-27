import { z } from "zod";

const partnerPeriodQuerySchema = z.object({
  unitId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

const partnerPriceGetQuerySchema = z.object({
  unitId: z.coerce.number().int().positive().optional(),
  asOf: z.preprocess(
    (v) => (v == null || v === "" ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  ),
});

const partnerPriceRowIn = z.object({
  commodityId: z.coerce.number().int().positive(),
  partnerUnitPrice: z.any().transform((v) => {
    if (v == null || v === "") {
      return null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }),
});

const partnerPricePutBodySchema = z.object({
  unitId: z.coerce.number().int().positive().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  note: z.string().max(500).nullish().optional(),
  rows: z.array(partnerPriceRowIn).min(1),
});

const lttpSupplierIdQuery = z.preprocess(
  (v) => (v == null || v === "" ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const partnerMatrixQuerySchema = z.object({
  unitId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  lttpSupplierId: lttpSupplierIdQuery,
});

const lttpSuppliersQuerySchema = z.object({
  unitId: z.coerce.number().int().positive().optional(),
});

const lttpSupplierParamsSchema = z.object({
  supplierId: z.coerce.number().int().positive(),
});

const partnerPaymentBodySchema = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  amount: z.coerce.number().finite().positive(),
  note: z.string().max(500).nullish().optional(),
});

export {
  partnerPeriodQuerySchema,
  partnerPriceGetQuerySchema,
  partnerPricePutBodySchema,
  partnerMatrixQuerySchema,
  lttpSuppliersQuerySchema,
  lttpSupplierParamsSchema,
  partnerPaymentBodySchema,
};
