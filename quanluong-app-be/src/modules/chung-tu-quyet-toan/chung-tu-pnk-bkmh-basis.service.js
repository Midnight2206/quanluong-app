import { prisma } from "../../infra/database/prisma/prisma.client.js";
import {
  CHUNG_TU_AGGREGATION_MODES,
  CHUNG_TU_CATEGORY_KEYS,
  normalizeAggregationMode,
} from "./chung-tu-category.constants.js";
import { normalizeMonthUnitIds, normalizePeriodMonth } from "./chung-tu-monthly-sheets.js";
import {
  formatCanCuPnkLine as formatCanCuPnkLineBase,
  formatCanCuPnkText as formatCanCuPnkTextBase,
} from "./chung-tu-nl-field.js";

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

function readSelectedUnitIdsFromSettings(settingsJson) {
  const settings = settingsJson && typeof settingsJson === "object" ? settingsJson : {};
  return normalizeMonthUnitIds(settings.__selectedUnitIds ?? settings.__bkmhUnitIds);
}

function toCanCuPnkSnapshot(snapshot) {
  return {
    soChungTu: snapshot?.soChungTu,
    buyerName: snapshot?.buyerName ?? snapshot?.nguoiMua,
    periodDate: snapshot?.periodDate,
    ngay: snapshot?.ngay,
    thang: snapshot?.thang,
    nam: snapshot?.nam,
  };
}

export function formatCanCuPnkLine(snapshot) {
  return formatCanCuPnkLineBase(toCanCuPnkSnapshot(snapshot));
}

export function formatCanCuPnkText(snapshots) {
  return formatCanCuPnkTextBase((snapshots ?? []).map(toCanCuPnkSnapshot));
}

async function loadBkmhDocumentsForStorageUnit(storageUnitId) {
  const uid = Number(storageUnitId);
  if (!Number.isInteger(uid) || uid <= 0) return [];
  return prisma.chungTuDocument.findMany({
    where: {
      unitId: uid,
      categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    },
    select: { id: true, settingsJson: true },
  });
}

function filterDocumentsByRecipientUnit(documents, recipientUnitId) {
  const rid = Number(recipientUnitId);
  if (!Number.isInteger(rid) || rid <= 0) return documents;
  return documents.filter((doc) => {
    const ids = readSelectedUnitIdsFromSettings(doc.settingsJson);
    return ids.includes(rid);
  });
}

async function fetchLatestSnapshots({ documentIds, periodMonth, periodDate }) {
  const ids = [...new Set((documentIds ?? []).map(Number).filter((id) => id > 0))];
  if (!ids.length) return [];
  const month = normalizePeriodMonth(periodMonth);
  const where = {
    documentId: { in: ids },
    periodMonth: month,
  };
  const date = String(periodDate ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    where.periodDate = date;
  }

  const rows = await prisma.chungTuBkmhSnapshot.findMany({
    where,
    orderBy: [{ syncedAt: "desc" }, { periodDate: "asc" }, { id: "desc" }],
  });

  const latestByKey = new Map();
  for (const row of rows) {
    const key = `${row.documentId}:${row.periodDate}`;
    if (!latestByKey.has(key)) {
      latestByKey.set(key, row);
    }
  }
  return [...latestByKey.values()].sort((a, b) =>
    String(a.periodDate).localeCompare(String(b.periodDate)),
  );
}

/**
 * Lấy snapshot BKMH làm căn cứ PNK — xử lý khác nhau theo chế độ gộp PNK.
 */
export async function resolveCanCuPnkForSheetContext({
  storageUnitId,
  periodMonth,
  sheetContext,
  pnkAggregationMode,
}) {
  const mode = normalizeAggregationMode(pnkAggregationMode);
  const month = normalizePeriodMonth(periodMonth);
  const docs = await loadBkmhDocumentsForStorageUnit(storageUnitId);
  if (!docs.length) return "";

  const periodDate = resolvePeriodDateFromContext(sheetContext);
  const recipientUnitId = Number(sheetContext?.recipientUnitId);

  if (mode === CHUNG_TU_AGGREGATION_MODES.BY_DAY) {
    if (!periodDate) return "";
    const scopedDocs = filterDocumentsByRecipientUnit(docs, recipientUnitId);
    const snapshots = await fetchLatestSnapshots({
      documentIds: scopedDocs.map((d) => d.id),
      periodMonth: month,
      periodDate,
    });
    return formatCanCuPnkText(snapshots);
  }

  if (mode === CHUNG_TU_AGGREGATION_MODES.BY_UNIT) {
    if (!Number.isInteger(recipientUnitId) || recipientUnitId <= 0) return "";
    const scopedDocs = filterDocumentsByRecipientUnit(docs, recipientUnitId);
    const snapshots = await fetchLatestSnapshots({
      documentIds: scopedDocs.map((d) => d.id),
      periodMonth: month,
    });
    return formatCanCuPnkText(snapshots);
  }

  const snapshots = await fetchLatestSnapshots({
    documentIds: docs.map((d) => d.id),
    periodMonth: month,
  });
  return formatCanCuPnkText(snapshots);
}

export async function attachCanCuPnkToMonthlyContexts(monthly, { storageUnitId, periodMonth, aggregationMode }) {
  if (!monthly?.rootContext) return monthly;
  const mode = normalizeAggregationMode(aggregationMode);

  for (const ctx of monthly.sheetContexts ?? []) {
    ctx.canCuPnk = await resolveCanCuPnkForSheetContext({
      storageUnitId,
      periodMonth,
      sheetContext: ctx,
      pnkAggregationMode: mode,
    });
  }

  monthly.rootContext.canCuPnk = await resolveCanCuPnkForSheetContext({
    storageUnitId,
    periodMonth,
    sheetContext: monthly.rootContext,
    pnkAggregationMode: mode,
  });

  return monthly;
}
