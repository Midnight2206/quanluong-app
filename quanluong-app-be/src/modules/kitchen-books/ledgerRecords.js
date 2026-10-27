/**
 * Bản ghi trợ lý sổ. Image backend chỉ có /app, nên file này nằm trong quanluong-app-be.
 * Web giữ bản sao packages/shared/src/pages/kitchen-books/ledgerRecords.js — hai file phải giống nhau.
 */
import { z } from "zod";

const count = z.coerce.number().int().min(0).max(100000);
const confidence = z.coerce.number().min(0).max(1);
const source = z.string().trim().min(1).max(180);
const day = z.string().trim().min(1).max(32);
const itemName = z.string().trim().min(1).max(255);
const qty = z.coerce.number().positive().max(1_000_000_000);

/** 180k → 180000. AI gửi số tiền, không gửi cột sổ. */
const money = z.preprocess((value) => {
  if (value == null || value === "") return null;
  const text = String(value).trim().toLowerCase().replace(/\s/g, "");
  if (!text) return null;
  const kilo = text.endsWith("k");
  const body = (kilo ? text.slice(0, -1) : text).replace(/\./g, "").replace(",", ".");
  const n = Number(body);
  if (!Number.isFinite(n) || n < 0) return value;
  return kilo ? n * 1000 : n;
}, z.number().nonnegative().max(1_000_000_000_000).nullable().optional());

const ledgerRecordSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("headcount"),
    date: day,
    levels: z.array(z.object({
      dailyAmount: z.coerce.number().positive(),
      sang: count,
      trua: count,
      chieu: count,
    })).min(1).max(6),
    extras: z.object({
      benhXa: count.optional(),
      benhNhan: count.optional(),
      omTrai: count.optional(),
      leTet: count.optional(),
    }).optional(),
    confidence,
    source,
  }),
  z.object({
    type: z.literal("outside_purchase"),
    date: day,
    name: itemName,
    qty,
    uom: z.string().max(64).optional(),
    unitPrice: money,
    column: z.enum(["G", "H", "I", "J"]).optional(),
    sourceKind: z.enum(["market", "tgsx"]).optional(),
    grade: z.string().trim().max(16).optional(),
    confidence,
    source,
  }),
  z.object({
    type: z.literal("stock_in"),
    date: day,
    name: itemName,
    qty,
    uom: z.string().max(64).optional(),
    unitPrice: money,
    origin: z.enum(["unit_purchase", "unit_tgsx"]),
    column: z.enum(["G", "H", "I", "J"]).optional(),
    sourceKind: z.enum(["market", "tgsx"]).optional(),
    grade: z.string().trim().max(16).optional(),
    confidence,
    source,
  }),
  z.object({
    type: z.literal("meal_out"),
    date: day,
    name: itemName,
    qty,
    uom: z.string().max(64).optional(),
    sourceKind: z.enum(["market", "tgsx"]).optional(),
    grade: z.string().trim().max(16).optional(),
    confidence,
    source,
  }),
  z.object({
    type: z.literal("stock_out"),
    date: day,
    name: itemName,
    qty,
    uom: z.string().max(64).optional(),
    sourceKind: z.enum(["market", "tgsx"]).optional(),
    grade: z.string().trim().max(16).optional(),
    confidence,
    source,
  }),
  z.object({
    type: z.literal("setting"),
    field: z.enum(["balanceWarnThreshold", "spentBasis", "holidayLunchOnly"]),
    value: z.union([z.string().max(64), z.number(), z.boolean()]),
    confidence,
    source,
  }),
  z.object({
    type: z.literal("question"),
    date: day.optional(),
    topic: z.enum(["finance", "anomaly", "stock", "receipts", "issues"]),
    itemName: z.string().max(80).optional(),
    confidence,
    source,
  }),
  z.object({
    type: z.literal("note"),
    text: z.string().trim().min(1).max(500),
    confidence,
    source,
  }),
  z.object({
    type: z.literal("schedule"),
    date: day,
    text: z.string().trim().min(1).max(2000),
    confidence,
    source,
  }),
]);

const ledgerRecordBatchSchema = z.object({
  records: z.array(ledgerRecordSchema).min(1).max(40),
}).strict();

const QUESTION_TOPIC = {
  finance: "explain_finance",
  anomaly: "anomalies",
  stock: "item_stock",
  receipts: "receipts",
  issues: "issues",
};

export { QUESTION_TOPIC, ledgerRecordBatchSchema, ledgerRecordSchema };
