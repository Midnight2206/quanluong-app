import { z } from "zod";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { mergeLedgerSettings } from "./kitchen-ledger-settings.js";

const FEATURE = "kitchen-ledger-headcount";
const LOW = 0.8;
const MEALS = ["sang", "trua", "chieu"];
const EXTRAS = ["benhXa", "benhNhan", "omTrai", "leTet"];

const countSchema = z.preprocess((value) => {
  if (typeof value === "string") return value.replace(/\s/g, "").replace(",", ".");
  return value;
}, z.coerce.number().int().min(0).max(100000));

const confidenceSchema = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n > 1 && n <= 100) return n / 100;
  return n;
}, z.number().min(0).max(1).optional());

const levelSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const counts = value.counts && typeof value.counts === "object" ? value.counts : {};
  return {
    dailyAmount: value.dailyAmount ?? value.muc,
    sang: value.sang ?? counts.sang,
    trua: value.trua ?? counts.trua,
    chieu: value.chieu ?? counts.chieu,
    confidence: value.confidence,
  };
}, z.object({
  dailyAmount: z.coerce.number().positive(),
  sang: countSchema,
  trua: countSchema,
  chieu: countSchema,
  confidence: confidenceSchema,
}));

const extrasSchema = z.object({
  benhXa: countSchema.optional(),
  benhNhan: countSchema.optional(),
  omTrai: countSchema.optional(),
  leTet: countSchema.optional(),
  confidence: confidenceSchema,
}).nullish();

const payloadSchema = z.object({
  days: z.array(z.object({
    date: z.string().min(1).max(32),
    levels: z.array(levelSchema).min(1).max(6),
    extras: extrasSchema,
  })).min(1).max(31),
});

function buildHeadcountPrompt(settings, anchorDate) {
  const s = mergeLedgerSettings(settings);
  const levels = s.levels.map((level) => Number(level.dailyAmount)).join(", ");
  return [
    "Trich quan so an tu tin nhan hoac anh so cham com.",
    "Khong ghi ho ten, cap bac, hay bat ky ten nguoi nao. Neu anh co cot ten thi bo qua, chi dem.",
    `Cac muc an, dung thu tu nay: ${levels}.`,
    "Moi muc co 3 so nguyen: sang, trua, chieu.",
    "Mau: 18/10: 91 97 97 · 0 0 0 la muc dau 91/97/97 va muc sau 0/0/0.",
    "An them neu co: benhXa, benhNhan, omTrai, leTet. Khong thay thi de 0 va confidence thap.",
    `Nam neo ${String(anchorDate).slice(0, 4)}. Ngay dang mo ${anchorDate}.`,
    'JSON: {"days":[{"date":"YYYY-MM-DD","levels":[{"dailyAmount":72000,"sang":0,"trua":0,"chieu":0,"confidence":0.9}],"extras":{"benhXa":0,"benhNhan":0,"omTrai":0,"leTet":0,"confidence":0.5}}]}',
    "confidence tu 0 den 1. Cho nao khong chac thi duoi 0.8. Nhieu ngay thi nhieu phan tu.",
  ].join(" ");
}

function resolveDate(raw, anchorDate) {
  const text = String(raw ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return validYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const slash = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/.exec(text);
  if (!slash) return null;
  let year = Number(String(anchorDate).slice(0, 4));
  if (slash[3]) year = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
  return validYmd(year, Number(slash[2]), Number(slash[1]));
}

function validYmd(year, month, day) {
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysApart(a, b) {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.abs(ms / 86_400_000);
}

function invalidOutput(message) {
  return new AppError({
    message: message || "AI trả về quân số không đúng mẫu. Nhập tay hoặc thử lại.",
    statusCode: 502,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
  });
}

function normalizeAiHeadcount(raw, { settings, anchorDate }) {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) throw invalidOutput();
  const s = mergeLedgerSettings(settings);
  const known = new Map(s.levels.map((level) => [Number(level.dailyAmount), level]));
  const warnings = [];
  const byDate = new Map();
  for (const day of parsed.data.days) {
    const date = resolveDate(day.date, anchorDate);
    if (!date) throw invalidOutput();
    if (byDate.has(date)) warnings.push(`${date} bị lặp, lấy bản sau.`);
    const dayWarnings = [];
    if (Number.isFinite(daysApart(date, anchorDate)) && daysApart(date, anchorDate) > 45) {
      dayWarnings.push("Ngày này cách ngày đang mở hơn 45 ngày.");
    }
    const got = new Map();
    for (const level of day.levels) {
      const amount = Number(level.dailyAmount);
      if (!known.has(amount)) {
        dayWarnings.push(`Bỏ mức ${amount} vì không có trong cấu hình đơn vị.`);
        continue;
      }
      got.set(amount, level);
    }
    const levels = s.levels.map((rule) => {
      const amount = Number(rule.dailyAmount);
      const row = got.get(amount);
      if (!row) {
        dayWarnings.push(`Thiếu mức ${amount}. Đang để 0 để soát lại.`);
        return {
          code: rule.code,
          dailyAmount: amount,
          sang: 0,
          trua: 0,
          chieu: 0,
          confidence: { sang: 0, trua: 0, chieu: 0 },
        };
      }
      const score = row.confidence ?? 0.85;
      return {
        code: rule.code,
        dailyAmount: amount,
        sang: row.sang,
        trua: row.trua,
        chieu: row.chieu,
        confidence: { sang: score, trua: score, chieu: score },
      };
    });
    let extras;
    let extrasConfidence;
    if (!day.extras) {
      dayWarnings.push("Không thấy suất ăn thêm. Đang để 0.");
      extras = { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 };
      extrasConfidence = 0.4;
    } else {
      extras = {
        benhXa: day.extras.benhXa ?? 0,
        benhNhan: day.extras.benhNhan ?? 0,
        omTrai: day.extras.omTrai ?? 0,
        leTet: day.extras.leTet ?? 0,
      };
      extrasConfidence = day.extras.confidence ?? 0.85;
      if (extrasConfidence < LOW) dayWarnings.push("Suất ăn thêm chưa chắc.");
    }
    for (const level of levels) {
      if (MEALS.some((meal) => level.confidence[meal] < LOW)) {
        dayWarnings.push(`Mức ${level.dailyAmount} cần soát lại.`);
      }
    }
    byDate.set(date, {
      date,
      headcount: {
        levels: levels.map(({ confidence: _confidence, ...level }) => level),
        extras,
      },
      confidence: {
        levels: levels.map((level) => ({ dailyAmount: level.dailyAmount, ...level.confidence })),
        extras: extrasConfidence,
      },
      warnings: dayWarnings,
    });
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { days, warnings };
}

function diffHeadcount(draftDay, confirmed) {
  const changes = [];
  const draftLevels = draftDay?.headcount?.levels || [];
  for (const level of confirmed?.levels || []) {
    const prev = draftLevels.find((row) => Number(row.dailyAmount) === Number(level.dailyAmount));
    for (const meal of MEALS) {
      const from = prev ? Number(prev[meal]) : null;
      const to = Number(level[meal]);
      if (from !== to) {
        changes.push({ date: draftDay.date, field: `${level.dailyAmount}.${meal}`, from, to });
      }
    }
  }
  for (const key of EXTRAS) {
    const from = Number(draftDay?.headcount?.extras?.[key] || 0);
    const to = Number(confirmed?.extras?.[key] || 0);
    if (from !== to) changes.push({ date: draftDay.date, field: `extras.${key}`, from, to });
  }
  return changes;
}

export {
  FEATURE,
  LOW,
  buildHeadcountPrompt,
  diffHeadcount,
  normalizeAiHeadcount,
  resolveDate,
};
