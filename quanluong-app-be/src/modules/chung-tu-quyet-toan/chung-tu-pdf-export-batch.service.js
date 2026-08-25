import crypto from "node:crypto";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  assertKnownCategoryKey,
  getAggregationModeLabel,
  normalizeAggregationMode,
} from "./chung-tu-category.constants.js";
import { normalizeMonthUnitIds, normalizePeriodMonth } from "./chung-tu-monthly-sheets.js";
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

function toIsoDateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : null;
}

function buildBatchPeriodDateValue({ meta, periodDate, periodMonth }) {
  if (periodMonth) {
    return new Date(`${periodMonth}-01T00:00:00.000Z`);
  }
  if (meta.mode === "by-date" && periodDate) {
    return new Date(`${periodDate}T00:00:00.000Z`);
  }
  return null;
}

function buildBatchDisplayName({ meta, aggregationMode, periodDate, periodMonth }) {
  const modeLabel = getAggregationModeLabel(aggregationMode);
  const periodLabel = periodMonth || periodDate || "không kỳ";
  return `${meta.label} - ${modeLabel} - ${periodLabel}`;
}

function mapBatchExportRow(row, batchKey) {
  const fileId = row.documentServiceFileId ?? null;
  return {
    id: row.id,
    exportKey: row.exportKey,
    fileId,
    fileName: row.fileName,
    sortKey: row.sortKey ?? null,
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
  issueSlipId,
  unitIds,
  aggregationMode,
  pdfTemplateId,
  signatures = {},
  signatureDates = {},
  signatureBlock,
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
  const safeAggregationMode = safePeriodMonth
    ? normalizeAggregationMode(aggregationMode)
    : undefined;
  const [{ context, sourceDataHash }, fieldsPayload, savedSignatureSettings] = await Promise.all([
    resolveChungTuContext({
      categoryKey,
      unitId,
      periodDate,
      periodMonth: safePeriodMonth,
      issueSlipId,
      unitIds: selectedUnitIds,
      aggregationMode: safeAggregationMode,
      settings,
    }),
    getTemplateFields(template.documentServiceTemplateId),
    getChungTuSignatureSettings({ categoryKey }),
  ]);

  const { fieldKeys, columnKeys } = extractTemplateKeys(fieldsPayload);
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
  });

  let folder = null;
  const createdFiles = [];
  try {
    folder = await createDocumentFolder({ name: batchKey });

    for (const slice of slices) {
      const payload = buildDocumentServicePayload({
        context: slice.context,
        fieldKeys,
        columnKeys,
        signatures,
        signatureDates,
        signatureBlock: finalSignatureBlock,
      });
      const file = await renderToDocumentFolder(folder.id, {
        templateId: template.documentServiceTemplateId,
        fileName: slice.fileName,
        sortKey: slice.sortKey,
        fields: payload.fields,
        rows: payload.rows,
        signatures: payload.signatures,
        signatureDates,
        signatureBlock: finalSignatureBlock,
      });
      createdFiles.push({
        exportKey: `ctpdf_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
        fileName: file.file_name,
        documentServiceFileId: Number(file.file_id),
        sortKey: slice.sortKey ?? null,
      });
    }

    const row = await prisma.chungTuPdfExportBatch.create({
      data: {
        batchKey,
        categoryKey,
        unitId: Number(unitId),
        periodMonth: safePeriodMonth ?? null,
        periodDate: buildBatchPeriodDateValue({
          meta,
          periodDate,
          periodMonth: safePeriodMonth,
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
            periodMonth: safePeriodMonth ?? null,
            periodDate: buildBatchPeriodDateValue({
              meta,
              periodDate,
              periodMonth: safePeriodMonth,
            }),
            issueSlipId: meta.mode === "by-slip" && !safePeriodMonth ? Number(issueSlipId) : null,
            unitIdsJson: selectedUnitIds ?? [],
            aggregationMode: safeAggregationMode ?? null,
            pdfTemplateId: template.id,
            documentServiceTemplateId: template.documentServiceTemplateId,
            fileName: file.fileName,
            documentServiceFileId: file.documentServiceFileId,
            sortKey: file.sortKey,
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
