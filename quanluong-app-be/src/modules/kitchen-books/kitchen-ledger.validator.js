import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date dạng YYYY-MM-DD");
const unitIdSchema = z.coerce.number().int().positive();
const qtySchema = z.coerce.number().positive().max(1_000_000_000);

const ledgerQuerySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
});

const ledgerMonthQuerySchema = z.object({
  unitId: unitIdSchema,
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month dạng YYYY-MM"),
});

const ledgerSettingsQuerySchema = z.object({
  unitId: unitIdSchema,
});

const headcountSchema = z.object({
  levels: z.array(z.object({
    code: z.string().max(32).optional(),
    dailyAmount: z.coerce.number().positive(),
    sang: z.coerce.number().min(0).max(100000),
    trua: z.coerce.number().min(0).max(100000),
    chieu: z.coerce.number().min(0).max(100000),
  })).min(1).max(12),
  extras: z.object({
    benhXa: z.coerce.number().min(0).max(100000).optional(),
    benhNhan: z.coerce.number().min(0).max(100000).optional(),
    omTrai: z.coerce.number().min(0).max(100000).optional(),
    leTet: z.coerce.number().min(0).max(100000).optional(),
  }).optional(),
});

const sourceKindSchema = z.enum(["market", "tgsx"]);
const gradeSchema = z.string().trim().min(1).max(16);

const selfSupplyLineSchema = z.object({
  commodityId: z.coerce.number().int().positive(),
  source: z.enum(["I", "J"]),
  qty: qtySchema,
  sourceKind: sourceKindSchema.optional(),
  grade: gradeSchema.optional(),
  issuePolicy: z.enum(["today", "all", "keep"]).optional(),
});

const riceLineSchema = z.object({
  commodityId: z.coerce.number().int().positive().optional(),
  name: z.string().max(255).optional(),
  source: z.enum(["G", "H", "I", "J"]),
  qty: qtySchema,
  unitPrice: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  sourceKind: sourceKindSchema.optional(),
  grade: gradeSchema.optional(),
});

const mealOutLineSchema = z.object({
  commodityId: z.coerce.number().int().positive().optional(),
  name: z.string().max(255).optional(),
  qty: qtySchema,
  unitPrice: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  sourceKind: sourceKindSchema.optional(),
  grade: gradeSchema.optional(),
});

const otherOutLineSchema = z.object({
  commodityId: z.coerce.number().int().positive().optional(),
  name: z.string().max(255).optional(),
  qty: qtySchema,
  sourceKind: sourceKindSchema.optional(),
  grade: gradeSchema.optional(),
});

const openingLineSchema = z.object({
  commodityId: z.coerce.number().int().positive().optional(),
  name: z.string().min(1).max(255),
  measureUnit: z.string().min(1).max(64),
  unitPrice: z.coerce.number().nonnegative().max(1_000_000_000),
  qty: z.coerce.number().nonnegative().max(1_000_000_000),
});

const saveLedgerBodySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
  headcount: headcountSchema.optional(),
  otherIncome: z.object({
    anThem: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
    truyLinh: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
    thuKhach: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
    riceSubsidy: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
  }).optional(),
  selfSupply: z.object({
    none: z.boolean().optional(),
    lines: z.array(selfSupplyLineSchema).max(200).optional(),
  }).optional(),
  rice: z.object({
    lines: z.array(riceLineSchema).max(20),
  }).optional(),
  mealOut: z.object({
    lines: z.array(mealOutLineSchema).max(400),
  }).optional(),
  otherOut: z.object({
    lines: z.array(otherOutLineSchema).max(200),
  }).optional(),
  opening: z.object({
    surplus: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
    shortfall: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
    lines: z.array(openingLineSchema).max(400).optional(),
  }).optional(),
  schedule: z.object({
    text: z.string().max(2000),
  }).nullable().optional(),
  version: z.coerce.number().int().nonnegative().optional(),
});

const syncLedgerSlipBodySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
  lines: z.array(z.object({
    commodityId: z.coerce.number().int().positive(),
    priceKind: z.enum(["market", "tgsx"]).optional(),
    quantity: qtySchema,
  })).max(200).optional(),
});

const lockLedgerBodySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
  confirmHeadcount: z.literal(true),
});

const unlockLedgerBodySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
  reason: z.string().trim().min(1).max(500),
});

const balanceLedgerBodySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
  confirm: z.boolean(),
});

const levelSchema = z.object({
  code: z.string().max(32),
  dailyAmount: z.coerce.number().positive(),
  mealPrices: z.object({
    sang: z.coerce.number().nonnegative(),
    trua: z.coerce.number().nonnegative(),
    chieu: z.coerce.number().nonnegative(),
  }),
});

const saveLedgerSettingsBodySchema = z.object({
  unitId: unitIdSchema,
  spentBasis: z.enum(["total_out", "meal_out"]).optional(),
  balanceWarnThreshold: z.coerce.number().positive().max(1_000_000_000).optional(),
  holidayLunchOnly: z.boolean().optional(),
  levels: z.array(levelSchema).min(1).max(12).optional(),
  signatures: z.object({
    soNhapXuat: z.array(z.object({
      key: z.string().max(40),
      title: z.string().max(80),
      name: z.string().max(120),
    })).max(6),
    cktc: z.array(z.object({
      key: z.string().max(40),
      title: z.string().max(80),
      name: z.string().max(120),
    })).max(6),
    soThucDon: z.array(z.object({
      key: z.string().max(40),
      title: z.string().max(80),
      name: z.string().max(120),
    })).max(6),
    soTheoDoi: z.array(z.object({
      key: z.string().max(40),
      title: z.string().max(80),
      name: z.string().max(120),
    })).max(6),
  }).partial().optional(),
  mealSelection: z.object({
    validFrom: dateSchema,
    rates: z.array(z.object({
      mealAllowanceRateId: z.coerce.number().int().positive(),
      percents: z.object({
        sang: z.coerce.number().min(0).max(100),
        trua: z.coerce.number().min(0).max(100),
        chieu: z.coerce.number().min(0).max(100),
      }),
      periodAmounts: z.object({
        sang: z.coerce.number().int().nonnegative(),
        trua: z.coerce.number().int().nonnegative(),
        chieu: z.coerce.number().int().nonnegative(),
      }).optional(),
    })).min(1).max(12),
  }).optional(),
});

export {
  ledgerQuerySchema,
  ledgerMonthQuerySchema,
  ledgerSettingsQuerySchema,
  headcountSchema,
  saveLedgerBodySchema,
  lockLedgerBodySchema,
  unlockLedgerBodySchema,
  balanceLedgerBodySchema,
  saveLedgerSettingsBodySchema,
  syncLedgerSlipBodySchema,
};
