import { prisma } from "../../infra/database/prisma/prisma.client.js";
import {
  CHUNG_TU_CATEGORY_KEYS,
  normalizeAggregationMode,
} from "./chung-tu-category.constants.js";
import { normalizePeriodMonth } from "./chung-tu-monthly-sheets.js";

function ymdParts(periodDate) {
  const d = String(periodDate ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return { ngay: "", thang: "", nam: "" };
  return { ngay: m[3], thang: m[2], nam: m[1] };
}

function resolveNguoiMua(context) {
  return String(
    context?.signerNguoiMua ?? context?.hoTenNguoiMua ?? context?.nguoiMua ?? "",
  ).trim();
}

function resolvePeriodDateFromContext(ctx) {
  const fromExtra = String(ctx?.periodDate ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromExtra)) return fromExtra;
  const fromNgay = String(ctx?.ngayChungTu ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromNgay)) return fromNgay;
  const parts = ctx ?? {};
  if (parts.nam && parts.thang && parts.ngay) {
    const dd = String(parts.ngay).padStart(2, "0");
    const mm = String(parts.thang).padStart(2, "0");
    return `${parts.nam}-${mm}-${dd}`;
  }
  return "";
}

function buildSnapshotRowFromContext(ctx, meta) {
  const periodDate = resolvePeriodDateFromContext(ctx);
  const parts = ymdParts(periodDate);
  const tongTienSo = Number(ctx?.tongTienSo);
  return {
    periodDate: periodDate || meta.periodMonth,
    sheetName: ctx?.sheetName ? String(ctx.sheetName).trim() : null,
    soChungTu: String(ctx?.soChungTu ?? ctx?.so ?? "").trim() || null,
    quyenSo: String(ctx?.quyenSo ?? "").trim() || null,
    ngay: parts.ngay || null,
    thang: parts.thang || null,
    nam: parts.nam || null,
    tongTien: Number.isFinite(tongTienSo) ? tongTienSo : 0,
    nguoiMua: resolveNguoiMua(ctx) || meta.nguoiMua || null,
  };
}

/**
 * Trích các dòng snapshot từ context BKMH (theo ngày nếu có sheetContexts).
 * @param {object} context
 * @param {{ periodMonth: string, aggregationMode?: string }} options
 */
export function buildBkmhSnapshotRows(context, { periodMonth, aggregationMode } = {}) {
  const safeMonth = normalizePeriodMonth(periodMonth);
  const mode = aggregationMode ? normalizeAggregationMode(aggregationMode) : null;
  const nguoiMua = resolveNguoiMua(context);
  const meta = { periodMonth: safeMonth, nguoiMua };

  const sheetContexts = Array.isArray(context?.sheetContexts) ? context.sheetContexts : [];
  if (sheetContexts.length > 0) {
    return sheetContexts
      .map((ctx) => buildSnapshotRowFromContext(ctx, meta))
      .filter((row) => row.periodDate);
  }

  const single = buildSnapshotRowFromContext(context, meta);
  if (!single.periodDate) return [];
  return [single];
}

/**
 * Lưu snapshot BKMH sau mỗi lần tạo/đồng bộ.
 */
export async function persistBkmhSnapshots({
  documentId,
  context,
  periodMonth,
  aggregationMode,
  sourceDataHash,
  eventType,
}) {
  const rows = buildBkmhSnapshotRows(context, { periodMonth, aggregationMode });
  if (!rows.length) return [];

  const syncedAt = new Date();
  const safeMonth = normalizePeriodMonth(periodMonth);
  const mode = aggregationMode ? normalizeAggregationMode(aggregationMode) : null;
  const event = String(eventType ?? "sync").trim() || "sync";

  await prisma.chungTuBkmhSnapshot.createMany({
    data: rows.map((row) => ({
      documentId: Number(documentId),
      eventType: event,
      syncedAt,
      periodMonth: safeMonth,
      periodDate: row.periodDate,
      sheetName: row.sheetName,
      soChungTu: row.soChungTu,
      quyenSo: row.quyenSo,
      ngay: row.ngay,
      thang: row.thang,
      nam: row.nam,
      tongTien: row.tongTien,
      nguoiMua: row.nguoiMua,
      aggregationMode: mode,
      sourceDataHash: sourceDataHash ?? null,
    })),
  });

  return rows;
}

export async function listBkmhSnapshotsForDocument(documentId, { limit = 500 } = {}) {
  const id = Number(documentId);
  if (!Number.isInteger(id) || id <= 0) return [];
  const take = Math.min(Math.max(Number(limit) || 500, 1), 2000);
  const rows = await prisma.chungTuBkmhSnapshot.findMany({
    where: { documentId: id },
    orderBy: [{ syncedAt: "desc" }, { periodDate: "asc" }],
    take,
  });
  return rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    eventType: row.eventType,
    syncedAt: row.syncedAt.toISOString(),
    periodMonth: row.periodMonth,
    periodDate: row.periodDate,
    sheetName: row.sheetName,
    soChungTu: row.soChungTu,
    quyenSo: row.quyenSo,
    ngay: row.ngay,
    thang: row.thang,
    nam: row.nam,
    tongTien: Number(row.tongTien),
    nguoiMua: row.nguoiMua,
    aggregationMode: row.aggregationMode,
    sourceDataHash: row.sourceDataHash,
  }));
}

export async function listLatestBkmhSnapshotsByPeriodDate({
  unitId,
  periodMonth,
  periodDate,
}) {
  const uid = Number(unitId);
  const month = normalizePeriodMonth(periodMonth);
  const date = String(periodDate ?? "").trim();
  if (!Number.isInteger(uid) || uid <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return [];
  }

  const docs = await prisma.chungTuDocument.findMany({
    where: {
      unitId: uid,
      categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    },
    select: { id: true },
  });
  if (!docs.length) return [];

  const documentIds = docs.map((d) => d.id);
  const rows = await prisma.chungTuBkmhSnapshot.findMany({
    where: {
      documentId: { in: documentIds },
      periodMonth: month,
      periodDate: date,
    },
    orderBy: [{ syncedAt: "desc" }],
  });

  const latestByDoc = new Map();
  for (const row of rows) {
    if (!latestByDoc.has(row.documentId)) {
      latestByDoc.set(row.documentId, row);
    }
  }

  return [...latestByDoc.values()].map((row) => ({
    documentId: row.documentId,
    syncedAt: row.syncedAt.toISOString(),
    periodMonth: row.periodMonth,
    periodDate: row.periodDate,
    soChungTu: row.soChungTu,
    quyenSo: row.quyenSo,
    ngay: row.ngay,
    thang: row.thang,
    nam: row.nam,
    tongTien: Number(row.tongTien),
    nguoiMua: row.nguoiMua,
  }));
}
