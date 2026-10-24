import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date dạng YYYY-MM-DD");
const unitIdSchema = z.coerce.number().int().positive();
const qtySchema = z.coerce.number().positive().max(1_000_000_000);

const ledgerQuerySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
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
  })).min(1).max(6),
  extras: z.object({
    benhXa: z.coerce.number().min(0).max(100000).optional(),
    benhNhan: z.coerce.number().min(0).max(100000).optional(),
    omTrai: z.coerce.number().min(0).max(100000).optional(),
    leTet: z.coerce.number().min(0).max(100000).optional(),
  }).optional(),
});

const selfSupplyLineSchema = z.object({
  commodityId: z.coerce.number().int().positive(),
  source: z.enum(["I", "J"]),
  qty: qtySchema,
  issuePolicy: z.enum(["today", "all", "keep"]).optional(),
});

const riceLineSchema = z.object({
  commodityId: z.coerce.number().int().positive().optional(),
  name: z.string().max(255).optional(),
  qty: qtySchema,
  unitPrice: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
});

const otherOutLineSchema = z.object({
  commodityId: z.coerce.number().int().positive().optional(),
  name: z.string().max(255).optional(),
  qty: qtySchema,
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
  }).optional(),
  selfSupply: z.object({
    none: z.boolean().optional(),
    lines: z.array(selfSupplyLineSchema).max(200).optional(),
  }).optional(),
  rice: z.object({
    lines: z.array(riceLineSchema).max(20),
  }).optional(),
  otherOut: z.object({
    lines: z.array(otherOutLineSchema).max(200),
  }).optional(),
  opening: z.object({
    surplus: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
    shortfall: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
    lines: z.array(openingLineSchema).max(400).optional(),
  }).optional(),
});

const lockLedgerBodySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
  confirmHeadcount: z.literal(true),
});

const unlockLedgerBodySchema = z.object({
  unitId: unitIdSchema,
  date: dateSchema,
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
  riceGrams: z.object({
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
  riceSettlementPrice: z.coerce.number().nonnegative().optional(),
  fuelPerServing: z.coerce.number().nonnegative().optional(),
  requireIssueSlip: z.boolean().optional(),
  requirePriceTable: z.boolean().optional(),
  riceManualOnGuarantee: z.boolean().optional(),
  milk: z.object({
    mode: z.enum(["patient_plus_levels", "purchase"]).optional(),
    boxesPerPerson: z.coerce.number().positive().optional(),
    fromPatientExtra: z.boolean().optional(),
    levelDailyAmounts: z.array(z.coerce.number()).max(6).optional(),
  }).optional(),
  levels: z.array(levelSchema).min(1).max(6).optional(),
  spices: z.array(z.object({
    match: z.string().min(1).max(80),
    peoplePerUnit: z.coerce.number().positive().optional(),
    qtyPerUnit: z.coerce.number().nonnegative().optional(),
    roundStep: z.coerce.number().positive().optional(),
    fixedQty: z.coerce.number().nonnegative().optional(),
  })).max(40).optional(),
});

export {
  ledgerQuerySchema,
  ledgerSettingsQuerySchema,
  headcountSchema,
  saveLedgerBodySchema,
  lockLedgerBodySchema,
  unlockLedgerBodySchema,
  balanceLedgerBodySchema,
  saveLedgerSettingsBodySchema,
};
