import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  CHUNG_TU_AGGREGATION_MODES,
  CHUNG_TU_CATEGORY_KEYS,
  CHUNG_TU_DOCUMENT_STATUS,
  assertKnownCategoryKey,
  getAggregationModeLabel,
  normalizeAggregationMode,
} from "./chung-tu-category.constants.js";
import { buildChungTuDocumentKey } from "./chung-tu-document-key.js";
import {
  persistBkmhSnapshots,
  listBkmhSnapshotsForDocument,
} from "./chung-tu-bkmh-snapshot.service.js";
import {
  assertTemplateInCategoryFolder,
  copyTemplateToUnitFolder,
} from "./chung-tu-drive-folders.service.js";
import { resolveChungTuContext } from "./chung-tu-data-resolver.service.js";
import { syncSpreadsheetFromContext } from "./chung-tu-sheet-sync.service.js";
import { normalizeMonthUnitIds, normalizePeriodMonth, lastDayOfMonth } from "./chung-tu-monthly-sheets.js";
import {
  getUserDriveFileAvailability,
  trashUserDriveFileIfExists,
} from "./chung-tu-drive-file-state.js";
import { resolveTemplateSelectionMeta } from "./chung-tu-template-tree.service.js";

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

function resolveSelectedUnitIds({ unitIds, unitId, effectiveUnitIds }) {
  const selected = normalizeMonthUnitIds(unitIds);
  if (selected.length) return selected;
  const scoped = normalizeMonthUnitIds(effectiveUnitIds);
  if (scoped.length) return scoped;
  return normalizeMonthUnitIds([unitId]);
}

function readDocumentSettings(row) {
  return row.settingsJson && typeof row.settingsJson === "object" ? row.settingsJson : {};
}

function resolveStoredPeriodMonth(row) {
  const settings = readDocumentSettings(row);
  return String(settings.__periodMonth ?? row.periodDate?.toISOString?.().slice(0, 7) ?? "").trim() || null;
}

function resolveStoredSelectedUnitIds(row, effectiveUnitIds) {
  const settings = readDocumentSettings(row);
  const fromSettings = normalizeMonthUnitIds(settings.__selectedUnitIds ?? settings.__bkmhUnitIds);
  if (fromSettings.length) return fromSettings;
  return resolveSelectedUnitIds({ unitIds: undefined, unitId: row.unitId, effectiveUnitIds });
}

function formatMonthYear(periodMonth) {
  const value = String(periodMonth ?? "").trim();
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return value;
  return `${m[2]}/${m[1]}`;
}

function enrichDocumentRow(row, { unitName = null, selectedUnitNames = [] } = {}) {
  const settings = readDocumentSettings(row);
  const periodMonth = resolveStoredPeriodMonth(row);
  const aggregationMode = settings.__aggregationMode
    ? normalizeAggregationMode(settings.__aggregationMode)
    : periodMonth
      ? CHUNG_TU_AGGREGATION_MODES.BY_DAY
      : null;
  const base = mapDocumentRow(row);
  return {
    ...base,
    documentName: settings.__templateDisplayName ?? row.templateName ?? "",
    documentCode: settings.__templateDriveFileName ?? row.templateName ?? "",
    periodMonth,
    aggregationMode,
    aggregationModeLabel: aggregationMode ? getAggregationModeLabel(aggregationMode) : "",
    unitName,
    selectedUnitNames,
    storageUnitName: unitName,
  };
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
  const driveUserId = row.createdById;
  if (!driveUserId) {
    throw new AppError({
      message: "Chứng từ thiếu thông tin người tạo — không thể truy cập Google Drive.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const availability = await getUserDriveFileAvailability({
    userId: driveUserId,
    fileId: row.outputDriveFileId,
  });
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

function buildOutputTitle({
  templateDisplayName,
  templateName,
  unitName,
  periodDate,
  periodMonth,
  issueSlipId,
  categoryKey,
}) {
  if (periodMonth) {
    const label = String(templateDisplayName ?? templateName ?? "").trim();
    const monthLabel = formatMonthYear(periodMonth);
    return `${label} — ${unitName ?? ""} — ${monthLabel}`.trim();
  }
  if (categoryKey === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO && issueSlipId) {
    return `${templateDisplayName ?? templateName ?? "Phiếu xuất kho"} — ${unitName ?? ""} — PX #${issueSlipId}`.trim();
  }
  return `${templateDisplayName ?? templateName ?? categoryKey} — ${unitName ?? ""} — ${periodDate ?? ""}`.trim();
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

function monthlyDocumentIncludesUnit(row, unitId, periodMonth) {
  const savedMonth = resolveStoredPeriodMonth(row);
  if (!savedMonth) return false;
  if (savedMonth !== periodMonth) return false;
  const selectedIds = resolveStoredSelectedUnitIds(row, null);
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
  const where = { unitId: Number(unitId) };
  if (categoryKey) {
    assertKnownCategoryKey(categoryKey);
    where.categoryKey = categoryKey;
  }
  if (from || to) {
    where.periodDate = {};
    if (from) where.periodDate.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.periodDate.lte = new Date(`${to}T23:59:59.999Z`);
  }
  const rows = await prisma.chungTuDocument.findMany({
    where,
    orderBy: [{ periodDate: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });
  const storageUnitName = await getUnitName(unitId);
  const allSelectedIds = new Set();
  for (const row of rows) {
    for (const id of resolveStoredSelectedUnitIds(row, effectiveUnitIds)) {
      allSelectedIds.add(id);
    }
  }
  const unitRows =
    allSelectedIds.size > 0
      ? await prisma.unit.findMany({
          where: { id: { in: [...allSelectedIds] } },
          select: { id: true, name: true },
        })
      : [];
  const unitNameById = new Map(unitRows.map((u) => [Number(u.id), u.name ?? ""]));
  return rows.map((row) => {
    const selectedIds = resolveStoredSelectedUnitIds(row, effectiveUnitIds);
    const selectedUnitNames = selectedIds.map((id) => unitNameById.get(id) ?? `Đơn vị #${id}`);
    return enrichDocumentRow(row, { unitName: storageUnitName, selectedUnitNames });
  });
}

function sameUnitIdSet(a, b) {
  const left = [...normalizeMonthUnitIds(a)].sort((x, y) => x - y);
  const right = [...normalizeMonthUnitIds(b)].sort((x, y) => x - y);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

async function findExistingMonthlyChungTuDocument({ categoryKey, unitId, periodMonth, unitIds }) {
  const month = normalizePeriodMonth(periodMonth);
  const ids = normalizeMonthUnitIds(unitIds);
  const uid = Number(unitId);
  const monthEnd = lastDayOfMonth(month);
  const candidates = await prisma.chungTuDocument.findMany({
    where: {
      unitId: uid,
      categoryKey,
      periodDate: {
        gte: new Date(`${month}-01T00:00:00.000Z`),
        lte: new Date(`${monthEnd}T23:59:59.999Z`),
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  for (const row of candidates) {
    const savedMonth = resolveStoredPeriodMonth(row);
    const savedUnits = resolveStoredSelectedUnitIds(row, null);
    if (savedMonth === month && sameUnitIdSet(savedUnits, ids)) {
      return row;
    }
  }
  return null;
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
  const unitName = await getUnitName(row.unitId);
  const selectedIds = resolveStoredSelectedUnitIds(available, effectiveUnitIds);
  const unitRows =
    selectedIds.length > 0
      ? await prisma.unit.findMany({
          where: { id: { in: selectedIds } },
          select: { id: true, name: true },
        })
      : [];
  const unitNameById = new Map(unitRows.map((u) => [Number(u.id), u.name ?? ""]));
  const selectedUnitNames = selectedIds.map((id) => unitNameById.get(id) ?? `Đơn vị #${id}`);
  return enrichDocumentRow(available, { unitName, selectedUnitNames });
}

async function previewChungTuContext({
  categoryKey,
  unitId,
  periodDate,
  periodMonth,
  issueSlipId,
  unitIds,
  aggregationMode,
  settings,
  effectiveUnitIds,
}) {
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const selectedUnitIds = periodMonth
    ? resolveSelectedUnitIds({ unitIds, unitId, effectiveUnitIds })
    : undefined;
  if (selectedUnitIds) {
    assertUnitIdsInEffectiveBranch(selectedUnitIds, effectiveUnitIds);
  }
  const { context, sourceDataHash } = await resolveChungTuContext({
    categoryKey,
    unitId,
    periodDate,
    periodMonth,
    issueSlipId,
    unitIds: selectedUnitIds,
    aggregationMode,
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
  const settings = readDocumentSettings(row);
  const periodMonth = resolveStoredPeriodMonth(row) ?? undefined;
  const unitIds = periodMonth
    ? resolveStoredSelectedUnitIds(row, effectiveUnitIds)
    : undefined;
  const aggregationMode = settings.__aggregationMode
    ? normalizeAggregationMode(settings.__aggregationMode)
    : periodMonth
      ? CHUNG_TU_AGGREGATION_MODES.BY_DAY
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
    aggregationMode,
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
  aggregationMode,
  templateDriveFileId,
  templateDisplayName,
  settings,
  createdById,
  effectiveUnitIds,
}) {
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const meta = assertKnownCategoryKey(categoryKey);
  const selectedUnitIds = periodMonth
    ? resolveSelectedUnitIds({ unitIds, unitId, effectiveUnitIds })
    : undefined;
  if (selectedUnitIds) {
    assertUnitIdsInEffectiveBranch(selectedUnitIds, effectiveUnitIds);
  }
  const safePeriodMonth = periodMonth ? normalizePeriodMonth(periodMonth) : undefined;
  const safeAggregationMode = safePeriodMonth
    ? normalizeAggregationMode(aggregationMode)
    : undefined;
  const documentKey = buildChungTuDocumentKey({
    categoryKey,
    unitId,
    periodDate: meta.mode === "by-date" && !safePeriodMonth ? periodDate : undefined,
    periodMonth: safePeriodMonth,
    issueSlipId: meta.mode === "by-slip" && !safePeriodMonth ? issueSlipId : undefined,
    unitIds: selectedUnitIds,
    aggregationMode: safeAggregationMode,
    templateDriveFileId: safePeriodMonth ? templateDriveFileId : undefined,
  });

  const existing = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
  let resolvedExisting = existing;
  const monthlyCategories = new Set([
    CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
    CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
  ]);
  if (
    !resolvedExisting &&
    monthlyCategories.has(categoryKey) &&
    safePeriodMonth &&
    selectedUnitIds?.length
  ) {
    resolvedExisting = await findExistingMonthlyChungTuDocument({
      categoryKey,
      unitId,
      periodMonth: safePeriodMonth,
      unitIds: selectedUnitIds,
    });
    if (resolvedExisting && resolvedExisting.documentKey !== documentKey) {
      const keyTaken = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
      if (!keyTaken) {
        resolvedExisting = await prisma.chungTuDocument.update({
          where: { id: resolvedExisting.id },
          data: { documentKey },
        });
      }
    }
  }
  if (resolvedExisting) {
    try {
      const available = await assertDocumentOutputAvailable(resolvedExisting, { deleteIfMissing: true });
      if (selectedUnitIds && safePeriodMonth) {
        const prevSettings = readDocumentSettings(available);
        await prisma.chungTuDocument.update({
          where: { id: available.id },
          data: {
            settingsJson: {
              ...prevSettings,
              __periodMonth: safePeriodMonth,
              __selectedUnitIds: selectedUnitIds,
              __bkmhUnitIds: selectedUnitIds,
              __aggregationMode: safeAggregationMode,
              __templateDisplayName:
                prevSettings.__templateDisplayName ??
                (String(templateDisplayName ?? "").trim() || null),
            },
          },
        });
      }
      const synced = await syncChungTuDocument({
        documentKey: available.documentKey,
        userId: createdById,
        effectiveUnitIds,
        snapshotEventType: "sync",
      });
      return { document: synced, created: false };
    } catch (error) {
      if (!(error instanceof AppError && error.statusCode === 404)) {
        throw error;
      }
    }
  }

  const { oauth2Client, meta: templateMeta } = await assertTemplateInCategoryFolder({
    userId: createdById,
    categoryKey,
    driveFileId: templateDriveFileId,
  });

  let templateSelectionMeta = null;
  try {
    templateSelectionMeta = await resolveTemplateSelectionMeta({
      userId: createdById,
      driveFileId: templateDriveFileId,
    });
  } catch {
    templateSelectionMeta = null;
  }
  const resolvedDisplayName =
    templateSelectionMeta?.fullDocumentName ||
    String(templateDisplayName ?? "").trim() ||
    templateMeta.name ||
    null;
  const resolvedDriveFileName =
    templateSelectionMeta?.driveFileName || templateMeta.name || null;

  const unitName = await getUnitName(unitId);
  const title = buildOutputTitle({
    templateDisplayName: resolvedDisplayName,
    templateName: templateMeta.name,
    unitName,
    periodDate,
    periodMonth: safePeriodMonth,
    issueSlipId,
    categoryKey,
  });

  const copied = await copyTemplateToUnitFolder({
    userId: createdById,
    templateDriveFileId,
    unitId,
    title,
  });

  const settingsJson = settings && typeof settings === "object" ? { ...settings } : {};
  if (selectedUnitIds && safePeriodMonth) {
    settingsJson.__periodMonth = safePeriodMonth;
    settingsJson.__selectedUnitIds = selectedUnitIds;
    settingsJson.__bkmhUnitIds = selectedUnitIds;
    settingsJson.__aggregationMode = safeAggregationMode;
    settingsJson.__templateDisplayName = resolvedDisplayName;
    settingsJson.__templateDriveFileName = resolvedDriveFileName;
    if (templateSelectionMeta?.folderPath?.length) {
      settingsJson.__templateFolderPath = templateSelectionMeta.folderPath;
    }
  }
  const periodDateValue = safePeriodMonth
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
      issueSlipId: meta.mode === "by-slip" && !safePeriodMonth ? Number(issueSlipId) : null,
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
    snapshotEventType: "create",
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
  await trashUserDriveFileIfExists({ userId: row.createdById, fileId: row.outputDriveFileId });
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
      const savedMonth = resolveStoredPeriodMonth(row);
      if (savedMonth && monthBounds) {
        return monthlyDocumentIncludesUnit(row, bkmhUnitId, monthBounds.periodMonth);
      }
      if (row.categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG && monthBounds) {
        return monthlyDocumentIncludesUnit(row, bkmhUnitId, monthBounds.periodMonth);
      }
      return true;
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

/** Đánh dấu stale mọi chứng từ (trừ khóa) của đơn vị kho — sau khi gán hàng loạt người mua trên phiếu LTTP. */
async function markChungTuDocumentsStaleForStorageUnit(storageUnitId) {
  const uid = Number(storageUnitId);
  if (!Number.isInteger(uid) || uid <= 0) {
    return { updatedCount: 0 };
  }
  const updated = await prisma.chungTuDocument.updateMany({
    where: {
      unitId: uid,
      status: { not: CHUNG_TU_DOCUMENT_STATUS.LOCKED },
    },
    data: { status: CHUNG_TU_DOCUMENT_STATUS.STALE },
  });
  return { updatedCount: updated.count };
}

async function syncChungTuDocument({
  documentKey,
  userId: _userId,
  effectiveUnitIds,
  oauth2Client: externalClient,
  snapshotEventType = "sync",
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
  const driveUserId = row.createdById;
  if (!oauth2Client) {
    const asserted = await assertTemplateInCategoryFolder({
      userId: driveUserId,
      categoryKey: row.categoryKey,
      driveFileId: row.templateDriveFileId,
    });
    oauth2Client = asserted.oauth2Client;
  }

  const settings =
    row.settingsJson && typeof row.settingsJson === "object" ? row.settingsJson : {};
  const layoutRowCountBySheet = settings._layoutDetailRowCountBySheet ?? null;

  const syncResult = await syncSpreadsheetFromContext({
    oauth2Client,
    spreadsheetId: row.outputDriveFileId,
    templateDriveFileId: row.templateDriveFileId,
    categoryKey: row.categoryKey,
    context,
    layoutRowCountBySheet,
  });

  const isStale = row.sourceDataHash && row.sourceDataHash !== sourceDataHash;
  const nextSettings = { ...settings };
  if (syncResult?.layoutRowCountBySheet) {
    nextSettings._layoutDetailRowCountBySheet = syncResult.layoutRowCountBySheet;
  }
  const updated = await prisma.chungTuDocument.update({
    where: { id: row.id },
    data: {
      lastSyncedAt: new Date(),
      sourceDataHash,
      status: CHUNG_TU_DOCUMENT_STATUS.SYNCED,
      settingsJson: nextSettings,
    },
  });

  if (row.categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG) {
    const periodMonth = resolveStoredPeriodMonth(updated);
    if (periodMonth) {
      const snapSettings = readDocumentSettings(updated);
      await persistBkmhSnapshots({
        documentId: updated.id,
        context,
        periodMonth,
        aggregationMode: snapSettings.__aggregationMode,
        sourceDataHash,
        eventType: snapshotEventType,
      });
    }
  }

  return {
    ...mapDocumentRow(updated),
    wasStale: Boolean(isStale),
    lineCount: context.detailRows?.length ?? 0,
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

async function listBkmhSnapshotsByDocumentKey({ documentKey, effectiveUnitIds }) {
  const row = await prisma.chungTuDocument.findUnique({ where: { documentKey } });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy chứng từ.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  if (row.categoryKey !== CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG) {
    throw new AppError({
      message: "Snapshot chỉ áp dụng cho bảng kê mua hàng.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const items = await listBkmhSnapshotsForDocument(row.id);
  return { documentKey, items };
}

export {
  listChungTuDocuments,
  getChungTuDocumentByKey,
  previewChungTuContext,
  createOrGetChungTuDocument,
  deleteChungTuDocument,
  markChungTuDocumentsStaleForLttpIssueSlipChange,
  markChungTuDocumentsStaleForStorageUnit,
  syncChungTuDocument,
  checkDocumentStale,
  listBkmhSnapshotsForDocument,
  listBkmhSnapshotsByDocumentKey,
};
