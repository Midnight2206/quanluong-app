import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  CHUNG_TU_CATEGORY_KEYS,
  CHUNG_TU_DOCUMENT_STATUS,
  assertKnownCategoryKey,
  getCategoryMeta,
} from "./chung-tu-category.constants.js";
import { buildChungTuDocumentKey } from "./chung-tu-document-key.js";
import {
  assertTemplateInCategoryFolder,
  copyTemplateToUnitFolder,
} from "./chung-tu-drive-folders.service.js";
import { resolveChungTuContext } from "./chung-tu-data-resolver.service.js";
import { syncSpreadsheetFromContext } from "./chung-tu-sheet-sync.service.js";
import { exportGoogleSheetPdfBuffer } from "./chung-tu-sheet-pdf-export.service.js";
import { normalizeMonthUnitIds, normalizePeriodMonth } from "./chung-tu-monthly-sheets.js";
import {
  getSystemDriveFileAvailability,
  trashSystemDriveFileIfExists,
} from "./chung-tu-drive-file-state.js";

function assertUnitInEffectiveBranch(unitId, effectiveUnitIds) {
  const uid = Number(unitId);
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    !effectiveUnitIds.some((id) => Number(id) === uid)
  ) {
    throw new AppError({
      message: "Đơn vị nằm ngoài phạm vi được phép.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

function assertUnitIdsInEffectiveBranch(unitIds, effectiveUnitIds) {
  for (const unitId of normalizeMonthUnitIds(unitIds)) {
    assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  }
}

function resolveSelectedBkmhUnitIds({ unitIds, unitId, effectiveUnitIds }) {
  const selected = normalizeMonthUnitIds(unitIds);
  if (selected.length) return selected;
  const scoped = normalizeMonthUnitIds(effectiveUnitIds);
  if (scoped.length) return scoped;
  return normalizeMonthUnitIds([unitId]);
}

function mapDocumentRow(row) {
  return {
    id: row.id,
    documentKey: row.documentKey,
    unitId: row.unitId,
    categoryKey: row.categoryKey,
    periodDate: row.periodDate ? row.periodDate.toISOString().slice(0, 10) : null,
    issueSlipId: row.issueSlipId,
    templateDriveFileId: row.templateDriveFileId,
    templateName: row.templateName,
    outputDriveFileId: row.outputDriveFileId,
    outputWebViewLink: row.outputWebViewLink,
    settingsJson: row.settingsJson ?? {},
    status: row.status,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    sourceDataHash: row.sourceDataHash,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function orphanedDocumentError() {
  return new AppError({
    message:
      "File Google Sheet của chứng từ không còn tồn tại. Bản ghi cũ đã được xóa, hãy tạo lại chứng từ.",
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
  });
}

async function deleteDocumentRow(row) {
  await prisma.chungTuDocument.delete({ where: { id: row.id } });
}

async function assertDocumentOutputAvailable(row, { deleteIfMissing = false } = {}) {
  const availability = await getSystemDriveFileAvailability(row.outputDriveFileId);
  if (!availability.exists) {
    if (deleteIfMissing) {
      await deleteDocumentRow(row);
    }
    throw orphanedDocumentError();
  }
  if (availability.webViewLink && availability.webViewLink !== row.outputWebViewLink) {
    return prisma.chungTuDocument.update({
      where: { id: row.id },
      data: { outputWebViewLink: availability.webViewLink },
    });
  }
  return row;
}

function buildOutputTitle({ categoryKey, unitName, periodDate, periodMonth, issueSlipId, templateName }) {
  const meta = getCategoryMeta(categoryKey);
  const label = meta?.label ?? categoryKey;
  if (categoryKey === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO) {
    return `${label} — ${unitName ?? ""} — PX #${issueSlipId}`.trim();
  }
  if (categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG && periodMonth) {
    return `${label} — ${unitName ?? ""} — ${periodMonth}`.trim() || templateName || label;
  }
  return `${label} — ${unitName ?? ""} — ${periodDate ?? ""}`.trim() || templateName || label;
}

function dateToYmd(date) {
  if (!date) return "";
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date).slice(0, 10);
}

function monthBoundsFromYmd(ymd) {
  const month = String(ymd ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  return {
    periodMonth: month,
    start: new Date(`${month}-01T00:00:00.000Z`),
    end: new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999)),
  };
}

function bkmhDocumentIncludesUnit(row, unitId, periodMonth) {
  if (row.categoryKey !== CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG) return false;
  const settings = row.settingsJson && typeof row.settingsJson === "object" ? row.settingsJson : {};
  const savedMonth = String(settings.__periodMonth ?? row.periodDate?.toISOString().slice(0, 7) ?? "");
  if (savedMonth && savedMonth !== periodMonth) return false;
  const selectedIds = normalizeMonthUnitIds(settings.__bkmhUnitIds);
  if (selectedIds.length) {
    return selectedIds.includes(Number(unitId));
  }
  return Number(row.unitId) === Number(unitId);
}

async function getUnitName(unitId) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { name: true } });
  return unit?.name ?? null;
}

async function listChungTuDocuments({ unitId, categoryKey, from, to, effectiveUnitIds }) {
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  assertKnownCategoryKey(categoryKey);
  const where = { unitId: Number(unitId), categoryKey };
  if (from || to) {
    where.periodDate = {};
    if (from) where.periodDate.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.periodDate.lte = new Date(`${to}T23:59:59.999Z`);
  }
  const rows = await prisma.chungTuDocument.findMany({
    where,
    orderBy: [{ periodDate: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
  return rows.map(mapDocumentRow);
}

async function getChungTuDocumentByKey({ documentKey, effectiveUnitIds }) {
  const row = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy chứng từ.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  const available = await assertDocumentOutputAvailable(row, { deleteIfMissing: true });
  return mapDocumentRow(available);
}

async function previewChungTuContext({
  categoryKey,
  unitId,
  periodDate,
  periodMonth,
  issueSlipId,
  unitIds,
  settings,
  effectiveUnitIds,
}) {
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const selectedBkmhUnitIds =
    categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG && periodMonth
      ? resolveSelectedBkmhUnitIds({ unitIds, unitId, effectiveUnitIds })
      : undefined;
  if (selectedBkmhUnitIds) {
    assertUnitIdsInEffectiveBranch(selectedBkmhUnitIds, effectiveUnitIds);
  }
  const { context, sourceDataHash } = await resolveChungTuContext({
    categoryKey,
    unitId,
    periodDate,
    periodMonth,
    issueSlipId,
    unitIds: selectedBkmhUnitIds,
    settings,
  });
  return { context, sourceDataHash };
}

async function resolveDocumentSourceHash(row, effectiveUnitIds) {
  const { sourceDataHash } = await resolveDocumentContextForRow(row, effectiveUnitIds);
  return sourceDataHash;
}

async function resolveDocumentContextForRow(row, effectiveUnitIds) {
  const periodDate = row.periodDate ? row.periodDate.toISOString().slice(0, 10) : null;
  const periodMonth =
    row.categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG
      ? row.settingsJson?.__periodMonth || periodDate?.slice(0, 7)
      : undefined;
  const unitIds =
    row.categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG
      ? resolveSelectedBkmhUnitIds({
          unitIds: row.settingsJson?.__bkmhUnitIds,
          unitId: row.unitId,
          effectiveUnitIds,
        })
      : undefined;
  if (unitIds) {
    assertUnitIdsInEffectiveBranch(unitIds, effectiveUnitIds);
  }
  return resolveChungTuContext({
    categoryKey: row.categoryKey,
    unitId: row.unitId,
    periodDate,
    periodMonth,
    issueSlipId: row.issueSlipId,
    unitIds,
    settings: row.settingsJson,
  });
}

async function refreshDocumentSyncStatus(row, effectiveUnitIds) {
  if (row.status === CHUNG_TU_DOCUMENT_STATUS.LOCKED) return row;
  const sourceDataHash = await resolveDocumentSourceHash(row, effectiveUnitIds);
  const stale = !row.sourceDataHash || row.sourceDataHash !== sourceDataHash;
  const nextStatus = stale ? CHUNG_TU_DOCUMENT_STATUS.STALE : CHUNG_TU_DOCUMENT_STATUS.SYNCED;
  if (row.status === nextStatus) {
    return row;
  }
  return prisma.chungTuDocument.update({
    where: { id: row.id },
    data: { status: nextStatus },
  });
}

async function createOrGetChungTuDocument({
  categoryKey,
  unitId,
  periodDate,
  periodMonth,
  issueSlipId,
  unitIds,
  templateDriveFileId,
  settings,
  createdById,
  effectiveUnitIds,
}) {
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const meta = assertKnownCategoryKey(categoryKey);
  const selectedBkmhUnitIds =
    categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG && periodMonth
      ? resolveSelectedBkmhUnitIds({ unitIds, unitId, effectiveUnitIds })
      : undefined;
  if (selectedBkmhUnitIds) {
    assertUnitIdsInEffectiveBranch(selectedBkmhUnitIds, effectiveUnitIds);
  }
  const safePeriodMonth = periodMonth ? normalizePeriodMonth(periodMonth) : undefined;
  const documentKey = buildChungTuDocumentKey({
    categoryKey,
    unitId,
    periodDate: meta.mode === "by-date" ? periodDate : undefined,
    periodMonth: safePeriodMonth,
    issueSlipId: meta.mode === "by-slip" ? issueSlipId : undefined,
    unitIds: selectedBkmhUnitIds,
  });

  const existing = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
  if (existing) {
    try {
      const available = await assertDocumentOutputAvailable(existing, { deleteIfMissing: true });
      const refreshed = await refreshDocumentSyncStatus(available, effectiveUnitIds);
      return { document: mapDocumentRow(refreshed), created: false };
    } catch (error) {
      if (!(error instanceof AppError && error.statusCode === 404)) {
        throw error;
      }
    }
  }

  const { oauth2Client, meta: templateMeta } = await assertTemplateInCategoryFolder({
    categoryKey,
    driveFileId: templateDriveFileId,
  });

  const unitName = await getUnitName(unitId);
  const title = buildOutputTitle({
    categoryKey,
    unitName,
    periodDate,
    periodMonth: safePeriodMonth,
    issueSlipId,
    templateName: templateMeta.name,
  });

  const copied = await copyTemplateToUnitFolder({
    templateDriveFileId,
    unitId,
    title,
  });

  const settingsJson = settings && typeof settings === "object" ? { ...settings } : {};
  if (selectedBkmhUnitIds) {
    settingsJson.__periodMonth = safePeriodMonth;
    settingsJson.__bkmhUnitIds = selectedBkmhUnitIds;
  }
  const periodDateValue =
    categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG && safePeriodMonth
      ? new Date(`${safePeriodMonth}-01T00:00:00.000Z`)
      : meta.mode === "by-date" && periodDate
        ? new Date(`${periodDate}T00:00:00.000Z`)
        : null;

  const row = await prisma.chungTuDocument.create({
    data: {
      documentKey,
      unitId: Number(unitId),
      categoryKey,
      periodDate: periodDateValue,
      issueSlipId: meta.mode === "by-slip" ? Number(issueSlipId) : null,
      templateDriveFileId,
      templateName: templateMeta.name ?? null,
      outputDriveFileId: copied.outputDriveFileId,
      outputWebViewLink: copied.outputWebViewLink,
      settingsJson,
      status: CHUNG_TU_DOCUMENT_STATUS.DRAFT,
      createdById,
    },
  });

  const synced = await syncChungTuDocument({
    documentKey,
    userId: createdById,
    effectiveUnitIds,
    oauth2Client,
  });

  return { document: synced, created: true };
}

async function deleteChungTuDocument({ documentKey, effectiveUnitIds }) {
  const row = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy chứng từ.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  if (row.status === CHUNG_TU_DOCUMENT_STATUS.LOCKED) {
    throw new AppError({
      message: "Chứng từ đã khóa — không thể xóa.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await trashSystemDriveFileIfExists(row.outputDriveFileId);
  await deleteDocumentRow(row);
  return { documentKey, deleted: true };
}

async function markChungTuDocumentsStaleForLttpIssueSlipChange({
  unitId,
  recipientUnitId,
  issueDate,
  issueSlipId,
}) {
  const uid = Number(unitId);
  const recipientUid = Number(recipientUnitId);
  const sid = Number(issueSlipId);
  const ymd = dateToYmd(issueDate);
  if (!Number.isInteger(uid) || uid <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { updatedCount: 0 };
  }
  const bkmhUnitId =
    Number.isInteger(recipientUid) && recipientUid > 0 ? recipientUid : uid;

  const dayStart = new Date(`${ymd}T00:00:00.000Z`);
  const dayEnd = new Date(`${ymd}T23:59:59.999Z`);
  const monthBounds = monthBoundsFromYmd(ymd);
  const or = [
    {
      unitId: uid,
      periodDate: { gte: dayStart, lte: dayEnd },
      categoryKey: { not: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG },
    },
  ];
  if (Number.isInteger(sid) && sid > 0) {
    or.push({
      categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
      issueSlipId: sid,
    });
  }
  if (monthBounds) {
    or.push({
      categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
      periodDate: { gte: monthBounds.start, lte: monthBounds.end },
    });
  }

  const candidates = await prisma.chungTuDocument.findMany({
    where: {
      status: { not: CHUNG_TU_DOCUMENT_STATUS.LOCKED },
      OR: or,
    },
    select: {
      id: true,
      unitId: true,
      categoryKey: true,
      periodDate: true,
      settingsJson: true,
    },
  });
  const ids = candidates
    .filter((row) => {
      if (row.categoryKey !== CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG) return true;
      return bkmhDocumentIncludesUnit(row, bkmhUnitId, monthBounds?.periodMonth);
    })
    .map((row) => row.id);
  if (!ids.length) {
    return { updatedCount: 0 };
  }
  const updated = await prisma.chungTuDocument.updateMany({
    where: { id: { in: ids }, status: { not: CHUNG_TU_DOCUMENT_STATUS.LOCKED } },
    data: { status: CHUNG_TU_DOCUMENT_STATUS.STALE },
  });
  return { updatedCount: updated.count };
}

async function syncChungTuDocument({
  documentKey,
  userId: _userId,
  effectiveUnitIds,
  oauth2Client: externalClient,
}) {
  let row = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy chứng từ.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  row = await assertDocumentOutputAvailable(row, { deleteIfMissing: true });

  if (row.status === CHUNG_TU_DOCUMENT_STATUS.LOCKED) {
    throw new AppError({
      message: "Chứng từ đã khóa — không thể đồng bộ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!row.outputDriveFileId) {
    throw new AppError({
      message: "Chứng từ chưa có file Google Sheets output.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const { context, sourceDataHash } = await resolveDocumentContextForRow(row, effectiveUnitIds);

  let oauth2Client = externalClient;
  if (!oauth2Client) {
    const asserted = await assertTemplateInCategoryFolder({
      categoryKey: row.categoryKey,
      driveFileId: row.templateDriveFileId,
    });
    oauth2Client = asserted.oauth2Client;
  }

  await syncSpreadsheetFromContext({
    oauth2Client,
    spreadsheetId: row.outputDriveFileId,
    templateDriveFileId: row.templateDriveFileId,
    categoryKey: row.categoryKey,
    context,
  });

  const isStale = row.sourceDataHash && row.sourceDataHash !== sourceDataHash;
  const updated = await prisma.chungTuDocument.update({
    where: { id: row.id },
    data: {
      lastSyncedAt: new Date(),
      sourceDataHash,
      status: CHUNG_TU_DOCUMENT_STATUS.SYNCED,
    },
  });

  return {
    ...mapDocumentRow(updated),
    wasStale: Boolean(isStale),
    lineCount: context.detailRows?.length ?? 0,
  };
}

async function buildChungTuDocumentPdf({ documentKey, effectiveUnitIds }) {
  let row = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy chứng từ.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  row = await assertDocumentOutputAvailable(row, { deleteIfMissing: true });
  if (row.status !== CHUNG_TU_DOCUMENT_STATUS.LOCKED) {
    await syncChungTuDocument({ documentKey, effectiveUnitIds });
    row = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
  } else {
    row = await refreshDocumentSyncStatus(row, effectiveUnitIds);
  }
  if (row.status !== CHUNG_TU_DOCUMENT_STATUS.SYNCED && row.status !== CHUNG_TU_DOCUMENT_STATUS.LOCKED) {
    throw new AppError({
      message: "Chứng từ chưa đồng bộ với dữ liệu LTTP hiện tại. Hãy bấm Đồng bộ trước khi in PDF.",
      statusCode: 409,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const { oauth2Client } = await assertTemplateInCategoryFolder({
    categoryKey: row.categoryKey,
    driveFileId: row.templateDriveFileId,
  });
  const buffer = await exportGoogleSheetPdfBuffer({
    oauth2Client,
    spreadsheetId: row.outputDriveFileId,
  });
  const safeKey = String(row.documentKey ?? "chung-tu").replace(/[^A-Za-z0-9_.-]+/g, "_");
  return {
    buffer,
    filename: `${safeKey}.pdf`,
    document: mapDocumentRow(row),
  };
}

async function checkDocumentStale({ documentKey, effectiveUnitIds }) {
  const row = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy chứng từ.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  const sourceDataHash = await resolveDocumentSourceHash(row, effectiveUnitIds);
  const stale = !row.sourceDataHash || row.sourceDataHash !== sourceDataHash;
  if (stale && row.status !== CHUNG_TU_DOCUMENT_STATUS.LOCKED) {
    await prisma.chungTuDocument.update({
      where: { id: row.id },
      data: { status: CHUNG_TU_DOCUMENT_STATUS.STALE },
    });
  }
  return {
    documentKey,
    stale,
    currentHash: sourceDataHash,
    savedHash: row.sourceDataHash,
  };
}

export {
  listChungTuDocuments,
  getChungTuDocumentByKey,
  previewChungTuContext,
  createOrGetChungTuDocument,
  deleteChungTuDocument,
  buildChungTuDocumentPdf,
  markChungTuDocumentsStaleForLttpIssueSlipChange,
  syncChungTuDocument,
  checkDocumentStale,
};
