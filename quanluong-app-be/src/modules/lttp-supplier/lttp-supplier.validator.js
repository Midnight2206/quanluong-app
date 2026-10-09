import { z } from "zod";

function isCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

const ordersQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate),
  supplierId: z.coerce.number().int().positive(),
});

const userLinksParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

const ledgerQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate),
  supplierId: z.coerce.number().int().positive(),
}).refine((query) => query.to >= query.from, {
  message: "Ngày kết thúc phải sau hoặc trùng ngày bắt đầu",
});

export { ledgerQuerySchema, ordersQuerySchema, userLinksParamsSchema };
