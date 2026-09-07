import crypto from "node:crypto";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  assertKnownCategoryKey,
  CHUNG_TU_CATEGORY_KEYS,
  CHUNG_TU_AGGREGATION_MODES,
  getAggregationModeLabel,
  normalizeAggregationMode,
} from "./chung-tu-category.constants.js";
import { normalizeMonthUnitIds, normalizePeriodMonth, lastDayOfMonth } from "./chung-tu-monthly-sheets.js";
import { resolveChungTuContext } from "./chung-tu-data-resolver.service.js";
import { buildDocumentServicePayload } from "./chung-tu-pdf-map.util.js";
import {
  createDocumentFolder,
  deleteDocumentFolder,
  getDocumentFolder,
  getTemplateFields,
  renderToDocumentFolder,
  streamDocumentFolderFile,
  streamDocumentFolderMergedPdf,
  streamDocumentFolderZip,
} from "../../services/document-service.client.js";
import { extractTemplateKeys } from "./chung-tu-pdf-export.service.js";
import { getChungTuSignatureSettings } from "./chung-tu-signature-settings.service.js";
import { pickExportSlices } from "./chung-tu-pdf-batch-slices.util.js";
import { fillSignatureDatesFromPeriod } from "./chung-tu-signature-dates.util.js";
import {
  buildExportContextJson,
  buildExportSummaryFromContext,
  sumFolderTongTien,
} from "./chung-tu-pdf-export-summary.util.js";

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

function notFoundError(message) {
  return new AppError({
    message,
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
  });
}

function buildBatchKey() {
  return `ctpdf_batch_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

const PNK_NGUOI_GIAO_SLOT_KEY = "nguoi_giao";
const PXK_NGUOI_NHAN_SLOT_KEY = "nguoi_nhan";

function materializePnkNguoiGiaoSignatureBlock(signatureBlock, context) {
  if (!signatureBlock || typeof signatureBlock !== "object") return signatureBlock;
  const rawSlots = Array.isArray(signatureBlock.slots) ? signatureBlock.slots : [];
  const existingSlot =
    rawSlots.find((slot) => slot && typeof slot === "object" && String(slot.key ?? "").trim() === PNK_NGUOI_GIAO_SLOT_KEY) ??
    null;
  const buyerSignatureName = String(context?.buyerSignatureName ?? "").trim();
  const lockedSlot = {
    ...(existingSlot && typeof existingSlot === "object" ? existingSlot : {}),
    key: PNK_NGUOI_GIAO_SLOT_KEY,
    label: "NGƯỜI GIAO",
    col: Number.isFinite(Number(existingSlot?.col)) ? Number(existingSlot.col) : 0,
    col_span: Number.isFinite(Number(existingSlot?.col_span)) ? Number(existingSlot.col_span) : 1,
    source: "static",
    static_name: buyerSignatureName,
    locked: true,
    show_date_line: Boolean(existingSlot?.show_date_line),
  };
  const otherSlots = rawSlots.filter(
    (slot) => !(slot && typeof slot === "object" && String(slot.key ?? "").trim() === PNK_NGUOI_GIAO_SLOT_KEY),
  );
  return {
    ...signatureBlock,
    slots: [lockedSlot, ...otherSlots],
  };
}

function materializePxkNguoiNhanSignatureBlock(signatureBlock, context) {
  if (!signatureBlock || typeof signatureBlock !== "object") return signatureBlock;
  const rawSlots = Array.isArray(signatureBlock.slots) ? signatureBlock.slots : [];
  const existingSlot =
    rawSlots.find(
      (slot) => slot && typeof slot === "object" && String(slot.key ?? "").trim() === PXK_NGUOI_NHAN_SLOT_KEY,
    ) ?? null;
  const signatureName =
    String(context?.signatureName ?? "").trim() || String(context?.nguoiNhan ?? "").trim() || "";
  const lockedSlot = {
    ...(existingSlot && typeof existingSlot === "object" ? existingSlot : {}),
    key: PXK_NGUOI_NHAN_SLOT_KEY,
    label: "NGƯỜI NHẬN",
    col: Number.isFinite(Number(existingSlot?.col)) ? Number(existingSlot.col) : 0,
    col_span: Number.isFinite(Number(existingSlot?.col_span)) ? Number(existingSlot.col_span) : 1,
    source: "static",
    // Empty string is intentional when unit has no recipient user — PDF still exports.
    static_name: signatureName,
    locked: true,
    show_date_line: Boolean(existingSlot?.show_date_line),
  };
  const otherSlots = rawSlots.filter(
    (slot) =>
      !(slot && typeof slot === "object" && String(slot.key ?? "").trim() === PXK_NGUOI_NHAN_SLOT_KEY),
  );
  return {
    ...signatureBlock,
    slots: [lockedSlot, ...otherSlots],
  };
}

function toIsoDateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : null;
}

function buildBatchPeriodDateValue({ meta, periodDate, periodMonth, dateFrom }) {
  if (periodMonth) {
    return new Date(`${periodMonth}-01T00:00:00.000Z`);
  }
  if (meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO && dateFrom) {
    return new Date(`${dateFrom}T00:00:00.000Z`);
  }
  if (meta.mode === "by-date" && periodDate) {
    return new Date(`${periodDate}T00:00:00.000Z`);
  }
  return null;
}

function buildBatchDisplayName({ meta, aggregationMode, periodDate, periodMonth, dateFrom, dateTo }) {
  const modeLabel = getAggregationModeLabel(aggregationMode);
  const periodLabel =
    dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : periodMonth || periodDate || "không kỳ";
  return `${meta.label} - ${modeLabel} - ${periodLabel}`;
}

function mapBatchExportRow(row, batchKey) {
  const fileId = row.documentServiceFileId ?? null;
  const summary =
    row.summaryJson && typeof row.summaryJson === "object" && !Array.isArray(row.summaryJson)
      ? row.summaryJson
      : null;
  return {
    id: row.id,
    exportKey: row.exportKey,
    fileId,
    fileName: row.fileName,
    sortKey: row.sortKey ?? null,
    soChungTu: summary?.soChungTu ?? null,
    periodDate: summary?.periodDate ?? null,
    ngayThangNam: summary?.ngayThangNam ?? null,
    tongTien: summary?.tongTien ?? null,
    recipientUnitName: summary?.recipientUnitName ?? null,
    summary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    downloadPath:
      fileId != null ? `/chungtuquyettoan/pdf-export-batches/${batchKey}/files/${fileId}` : null,
  };
}

function mapBatchRow(row) {
  const signaturesMeta =
    row.signaturesJson && typeof row.signaturesJson === "object" ? row.signaturesJson : {};
  const files = Array.isArray(row.exports)
    ? row.exports.map((item) => mapBatchExportRow(item, row.batchKey))
    : [];
  return {
    id: row.id,
    batchKey: row.batchKey,
    categoryKey: row.categoryKey,
    unitId: row.unitId,
    periodMonth: row.periodMonth ?? null,
    periodDate: toIsoDateOnly(row.periodDate),
    issueSlipId: row.issueSlipId ?? null,
    unitIds: normalizeMonthUnitIds(row.unitIdsJson),
    aggregationMode: row.aggregationMode ?? null,
    pdfTemplateId: row.pdfTemplateId,
    documentServiceTemplateId: row.documentServiceTemplateId,
    folderId: row.documentServiceFolderId,
    displayName: row.displayName,
    fileCount: row.fileCount,
    sourceDataHash: row.sourceDataHash ?? null,
    signatures: signaturesMeta.signatures ?? {},
    signatureDates: signaturesMeta.signatureDates ?? {},
    signatureBlock: signaturesMeta.signatureBlock ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    zipPath: `/chungtuquyettoan/pdf-export-batches/${row.batchKey}/zip`,
    mergedPdfPath: `/chungtuquyettoan/pdf-export-batches/${row.batchKey}/merged.pdf`,
    tongTienFolder: sumFolderTongTien(files),
    files,
  };
}

async function loadBatchRowOrThrow(batchKey) {
  const row = await prisma.chungTuPdfExportBatch.findUnique({
    where: { batchKey },
    include: {
      exports: {
        orderBy: [{ sortKey: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy lô xuất PDF.");
  }
  return row;
}

async function createChungTuPdfExportBatch({
  categoryKey,
  unitId,
  periodDate,
  periodMonth,
  dateFrom,
  dateTo,
  issueSlipId,
  unitIds,
  aggregationMode,
  pdfTemplateId,
  signatures = {},
  signatureDates = {},
  signatureBlock,
  settings,
  exportingUserProfile,
  createdById,
  effectiveUnitIds,
}) {
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const meta = assertKnownCategoryKey(categoryKey);
  const isPnk = categoryKey === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO;
  const isPxk = categoryKey === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO;
  const selectedUnitIds = periodMonth && !isPnk
    ? resolveSelectedUnitIds({ unitIds, unitId, effectiveUnitIds })
    : undefined;
  if (selectedUnitIds) {
    assertUnitIdsInEffectiveBranch(selectedUnitIds, effectiveUnitIds);
  }

  const template = await prisma.chungTuPdfTemplate.findFirst({
    where: {
      id: Number(pdfTemplateId),
      status: "published",
      categoryKey,
    },
  });
  if (!template) {
    throw notFoundError("Không tìm thấy mẫu PDF.");
  }

  const safePeriodMonth = periodMonth ? normalizePeriodMonth(periodMonth) : undefined;
  const safeDateFrom = isPnk ? String(dateFrom ?? "").trim() : "";
  const safeDateTo = isPnk ? String(dateTo ?? "").trim() : "";
  const safeAggregationMode = isPnk
    ? aggregationMode === CHUNG_TU_AGGREGATION_MODES.FULL
      ? CHUNG_TU_AGGREGATION_MODES.FULL
      : CHUNG_TU_AGGREGATION_MODES.BY_DAY
    : safePeriodMonth
      ? normalizeAggregationMode(aggregationMode)
      : undefined;
  const [fieldsPayload, savedSignatureSettings] = await Promise.all([
    getTemplateFields(template.documentServiceTemplateId),
    getChungTuSignatureSettings({ categoryKey }),
  ]);
  const resolveArgs = {
    categoryKey,
    unitId,
    periodDate,
    periodMonth: safePeriodMonth,
    issueSlipId,
    unitIds: selectedUnitIds,
    aggregationMode: safeAggregationMode,
    settings,
    exportingUserProfile,
  };
  if (isPnk) {
    resolveArgs.dateFrom = safeDateFrom || undefined;
    resolveArgs.dateTo = safeDateTo || undefined;
    resolveArgs.lyDoNhapKho = String(savedSignatureSettings?.extraFields?.lyDoNhapKho ?? "").trim();
    resolveArgs.nhapTaiKho = String(savedSignatureSettings?.extraFields?.nhapTaiKho ?? "").trim();
  }
  if (isPxk) {
    resolveArgs.xuatTaiKho = String(savedSignatureSettings?.extraFields?.xuatTaiKho ?? "").trim();
    resolveArgs.diaDiem = String(savedSignatureSettings?.extraFields?.diaDiem ?? "").trim();
  }
  const { context, sourceDataHash } = await resolveChungTuContext(resolveArgs);

  const { fieldKeys, columnKeys } = extractTemplateKeys(fieldsPayload);
  const fieldLabels =
    template.fieldLabelsJson && typeof template.fieldLabelsJson === "object" && !Array.isArray(template.fieldLabelsJson)
      ? Object.fromEntries(
          Object.entries(template.fieldLabelsJson).map(([key, value]) => [String(key), String(value ?? "")]),
        )
      : {};
  const finalSignatureBlock = signatureBlock ?? savedSignatureSettings?.signatureBlock ?? undefined;
  const batchContext = { ...(context ?? {}), categoryKey };
  const slices = pickExportSlices({
    aggregationMode: safeAggregationMode,
    context: batchContext,
  });
  const batchKey = buildBatchKey();
  const displayName = buildBatchDisplayName({
    meta,
    aggregationMode: safeAggregationMode,
    periodDate,
    periodMonth: safePeriodMonth,
    dateFrom: safeDateFrom,
    dateTo: safeDateTo,
  });
  const historyPeriodMonth =
    safePeriodMonth ?? (isPnk && safeDateFrom ? safeDateFrom.slice(0, 7) : null);

  let folder = null;
  const createdFiles = [];
  try {
    folder = await createDocumentFolder({ name: batchKey });

    for (const slice of slices) {
      const sliceSignatureBlock = isPnk
        ? materializePnkNguoiGiaoSignatureBlock(finalSignatureBlock, slice.context)
        : isPxk
          ? materializePxkNguoiNhanSignatureBlock(finalSignatureBlock, slice.context)
          : finalSignatureBlock;
      const sliceSignatureDates = fillSignatureDatesFromPeriod({
        signatureBlock: sliceSignatureBlock,
        signatureDates,
        context: slice.context,
        aggregationMode: safeAggregationMode,
        periodMonth: safePeriodMonth,
        lastDayOfMonthFn: lastDayOfMonth,
      });
      const payload = buildDocumentServicePayload({
        context: slice.context,
        fieldKeys,
        columnKeys,
        fieldLabels,
        signatures,
        signatureDates: sliceSignatureDates,
        signatureBlock: sliceSignatureBlock,
      });
      const file = await renderToDocumentFolder(folder.id, {
        templateId: template.documentServiceTemplateId,
        fileName: slice.fileName,
        sortKey: slice.sortKey,
        fields: payload.fields,
        rows: payload.rows,
        signatures: payload.signatures,
        signatureDates: sliceSignatureDates,
        signatureBlock: sliceSignatureBlock,
      });
      createdFiles.push({
        exportKey: `ctpdf_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
        fileName: file.file_name,
        documentServiceFileId: Number(file.file_id),
        sortKey: slice.sortKey ?? null,
        summaryJson: buildExportSummaryFromContext(slice.context),
        contextJson: buildExportContextJson(slice.context),
      });
    }

    const row = await prisma.chungTuPdfExportBatch.create({
      data: {
        batchKey,
        categoryKey,
        unitId: Number(unitId),
        periodMonth: historyPeriodMonth,
        periodDate: buildBatchPeriodDateValue({
          meta,
          periodDate,
          periodMonth: safePeriodMonth,
          dateFrom: safeDateFrom,
        }),
        issueSlipId: meta.mode === "by-slip" && !safePeriodMonth ? Number(issueSlipId) : null,
        unitIdsJson: selectedUnitIds ?? [],
        aggregationMode: safeAggregationMode ?? null,
        pdfTemplateId: template.id,
        documentServiceTemplateId: template.documentServiceTemplateId,
        documentServiceFolderId: Number(folder.id),
        displayName,
        fileCount: createdFiles.length,
        sourceDataHash,
        signaturesJson: {
          signatures,
          signatureDates,
          ...(finalSignatureBlock ? { signatureBlock: finalSignatureBlock } : {}),
        },
        createdById,
        exports: {
          create: createdFiles.map((file) => ({
            exportKey: file.exportKey,
            categoryKey,
            unitId: Number(unitId),
            periodMonth: historyPeriodMonth,
            periodDate: buildBatchPeriodDateValue({
              meta,
              periodDate,
              periodMonth: safePeriodMonth,
              dateFrom: safeDateFrom,
            }),
            issueSlipId: meta.mode === "by-slip" && !safePeriodMonth ? Number(issueSlipId) : null,
            unitIdsJson: selectedUnitIds ?? [],
            aggregationMode: safeAggregationMode ?? null,
            pdfTemplateId: template.id,
            documentServiceTemplateId: template.documentServiceTemplateId,
            fileName: file.fileName,
            documentServiceFileId: file.documentServiceFileId,
            sortKey: file.sortKey,
            summaryJson: file.summaryJson,
            contextJson: file.contextJson,
            sourceDataHash,
            signaturesJson: {
              signatures,
              signatureDates,
              ...(finalSignatureBlock ? { signatureBlock: finalSignatureBlock } : {}),
            },
            createdById,
          })),
        },
      },
      include: {
        exports: {
          orderBy: [{ sortKey: "asc" }, { id: "asc" }],
        },
      },
    });

    return mapBatchRow(row);
  } catch (error) {
    if (folder?.id != null) {
      await deleteDocumentFolder(folder.id).catch(() => {});
    }
    throw error;
  }
}

async function listChungTuPdfExportBatches({ unitId, categoryKey, effectiveUnitIds }) {
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const where = { unitId: Number(unitId) };
  if (categoryKey) {
    assertKnownCategoryKey(categoryKey);
    where.categoryKey = categoryKey;
  }
  const rows = await prisma.chungTuPdfExportBatch.findMany({
    where,
    include: {
      exports: {
        orderBy: [{ sortKey: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
  return rows.map(mapBatchRow);
}

async function getChungTuPdfExportBatch({ batchKey, effectiveUnitIds }) {
  const row = await loadBatchRowOrThrow(batchKey);
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  return mapBatchRow(row);
}

async function deleteChungTuPdfExportBatch({ batchKey, effectiveUnitIds }) {
  const row = await prisma.chungTuPdfExportBatch.findUnique({
    where: { batchKey },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy lô xuất PDF.");
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  await deleteDocumentFolder(row.documentServiceFolderId);
  await prisma.chungTuPdfExportBatch.delete({
    where: { id: row.id },
  });
  return { batchKey, deleted: true };
}

async function streamChungTuPdfExportBatchZip({ batchKey, effectiveUnitIds }) {
  const row = await prisma.chungTuPdfExportBatch.findUnique({
    where: { batchKey },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy lô xuất PDF.");
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  return streamDocumentFolderZip(row.documentServiceFolderId);
}

async function streamChungTuPdfExportBatchMergedPdf({ batchKey, effectiveUnitIds }) {
  const row = await prisma.chungTuPdfExportBatch.findUnique({
    where: { batchKey },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy lô xuất PDF.");
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  return streamDocumentFolderMergedPdf(row.documentServiceFolderId);
}

async function streamChungTuPdfExportBatchFile({ batchKey, fileId, effectiveUnitIds }) {
  const row = await loadBatchRowOrThrow(batchKey);
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  const file = row.exports.find((item) => Number(item.documentServiceFileId) === Number(fileId));
  if (!file?.documentServiceFileId) {
    throw notFoundError("Không tìm thấy file PDF trong lô xuất.");
  }
  return streamDocumentFolderFile(row.documentServiceFolderId, file.documentServiceFileId);
}

async function getChungTuPdfExportBatchFolder({ batchKey, effectiveUnitIds }) {
  const row = await prisma.chungTuPdfExportBatch.findUnique({
    where: { batchKey },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy lô xuất PDF.");
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  return getDocumentFolder(row.documentServiceFolderId);
}

export {
  createChungTuPdfExportBatch,
  deleteChungTuPdfExportBatch,
  getChungTuPdfExportBatch,
  getChungTuPdfExportBatchFolder,
  listChungTuPdfExportBatches,
  streamChungTuPdfExportBatchFile,
  streamChungTuPdfExportBatchMergedPdf,
  streamChungTuPdfExportBatchZip,
};
