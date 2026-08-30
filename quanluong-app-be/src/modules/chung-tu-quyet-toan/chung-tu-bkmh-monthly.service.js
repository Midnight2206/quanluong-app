import crypto from "node:crypto";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { CHUNG_TU_CATEGORY_KEYS, normalizeAggregationMode } from "./chung-tu-category.constants.js";
import { normalizeMonthUnitIds, normalizePeriodMonth } from "./chung-tu-monthly-sheets.js";
import { resolveChungTuContext } from "./chung-tu-data-resolver.service.js";
import { buildDocumentServicePayload } from "./chung-tu-pdf-map.util.js";
import {
  createDocumentFolder,
  deleteDocumentFolder,
  getTemplateFields,
  renderToDocumentFolder,
  streamDocumentFolderFile,
  streamDocumentFolderMergedPdf,
  streamDocumentFolderZip,
} from "../../services/document-service.client.js";
import { extractTemplateKeys } from "./chung-tu-pdf-export.service.js";
import { getChungTuSignatureSettings } from "./chung-tu-signature-settings.service.js";
import { pickExportSlices } from "./chung-tu-pdf-batch-slices.util.js";
import { buildBkmhSliceMetadata, sumSliceTongTien } from "./chung-tu-bkmh-slice-metadata.util.js";

const CATEGORY_KEY = CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG;

function assertStorageUnitInEffectiveBranch(storageUnitId, effectiveUnitIds) {
  const uid = Number(storageUnitId);
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
    assertStorageUnitInEffectiveBranch(unitId, effectiveUnitIds);
  }
}

function resolveSelectedUnitIds({ unitIds, storageUnitId, effectiveUnitIds }) {
  const selected = normalizeMonthUnitIds(unitIds);
  if (selected.length) return selected;
  const scoped = normalizeMonthUnitIds(effectiveUnitIds);
  if (scoped.length) return scoped;
  return normalizeMonthUnitIds([storageUnitId]);
}

function notFoundError(message) {
  return new AppError({
    message,
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
  });
}

function buildFolderName() {
  return `bkmh_monthly_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

function toIsoDateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : null;
}

function toDateOnly(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return new Date(`${text}T00:00:00.000Z`);
}

function buildDisplayName(periodMonth, context) {
  const unitName = String(context?.donVi ?? "").trim() || "Kho";
  return `BKMH ${periodMonth.slice(5, 7)}/${periodMonth.slice(0, 4)} — ${unitName}`;
}

function mapSliceRow(monthlyId, row) {
  return {
    id: row.id,
    sortKey: row.sortKey,
    soChungTu: row.soChungTu ?? null,
    periodDate: toIsoDateOnly(row.periodDate),
    recipientUnitId: row.recipientUnitId ?? null,
    recipientUnitName: row.recipientUnitName ?? null,
    ngayThangNam: row.ngayThangNam ?? null,
    tongTien: row.tongTien == null ? null : Number(row.tongTien),
    fileId: row.documentServiceFileId,
    fileName: row.fileName,
    filePath: `/chungtuquyettoan/bkmh-monthly/${monthlyId}/slices/${row.id}/file`,
  };
}

function mapMonthlyRow(row) {
  return {
    id: row.id,
    storageUnitId: row.storageUnitId,
    periodMonth: row.periodMonth,
    aggregationMode: row.aggregationMode,
    unitIds: normalizeMonthUnitIds(row.unitIdsJson),
    displayName: row.displayName,
    tongTienThang: row.tongTienThang == null ? null : Number(row.tongTienThang),
    sliceCount: row.sliceCount,
    folderId: row.documentServiceFolderId,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    zipPath: `/chungtuquyettoan/bkmh-monthly/${row.id}/zip`,
    mergedPdfPath: `/chungtuquyettoan/bkmh-monthly/${row.id}/merged.pdf`,
    slices: Array.isArray(row.slices) ? row.slices.map((item) => mapSliceRow(row.id, item)) : [],
  };
}

function buildSliceCreateInput({ renderedFile, slice }) {
  const meta = buildBkmhSliceMetadata(slice.context);
  return {
    sortKey: slice.sortKey,
    soChungTu: meta.soChungTu,
    periodDate: toDateOnly(meta.periodDate),
    recipientUnitId: meta.recipientUnitId,
    recipientUnitName: meta.recipientUnitName,
    ngayThangNam: meta.ngayThangNam,
    tongTien: meta.tongTien,
    documentServiceFileId: Number(renderedFile.file_id),
    fileName: renderedFile.file_name,
  };
}

async function loadMonthlyRowOrThrow(id) {
  const row = await prisma.chungTuBkmhMonthly.findUnique({
    where: { id: Number(id) },
    include: {
      slices: {
        orderBy: [{ sortKey: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy BKMH tháng.");
  }
  return row;
}

async function createChungTuBkmhMonthlyExport({
  storageUnitId,
  periodMonth,
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
  assertStorageUnitInEffectiveBranch(storageUnitId, effectiveUnitIds);
  const safePeriodMonth = normalizePeriodMonth(periodMonth);
  const safeAggregationMode = normalizeAggregationMode(aggregationMode);
  const selectedUnitIds = resolveSelectedUnitIds({
    unitIds,
    storageUnitId,
    effectiveUnitIds,
  });
  assertUnitIdsInEffectiveBranch(selectedUnitIds, effectiveUnitIds);

  const existingRow = await prisma.chungTuBkmhMonthly.findUnique({
    where: {
      storageUnitId_periodMonth: {
        storageUnitId: Number(storageUnitId),
        periodMonth: safePeriodMonth,
      },
    },
    include: {
      slices: {
        orderBy: [{ sortKey: "asc" }, { id: "asc" }],
      },
    },
  });

  const template = await prisma.chungTuPdfTemplate.findFirst({
    where: {
      id: Number(pdfTemplateId),
      status: "published",
      categoryKey: CATEGORY_KEY,
    },
  });
  if (!template) {
    throw notFoundError("Không tìm thấy mẫu PDF.");
  }

  const [{ context, sourceDataHash }, fieldsPayload, savedSignatureSettings] = await Promise.all([
    resolveChungTuContext({
      categoryKey: CATEGORY_KEY,
      unitId: Number(storageUnitId),
      periodDate: undefined,
      periodMonth: safePeriodMonth,
      issueSlipId: undefined,
      unitIds: selectedUnitIds,
      aggregationMode: safeAggregationMode,
      settings,
      exportingUserProfile,
    }),
    getTemplateFields(template.documentServiceTemplateId),
    getChungTuSignatureSettings({ categoryKey: CATEGORY_KEY }),
  ]);

  const { fieldKeys, columnKeys } = extractTemplateKeys(fieldsPayload);
  const finalSignatureBlock = signatureBlock ?? savedSignatureSettings?.signatureBlock ?? undefined;
  const exportContext = { ...(context ?? {}), categoryKey: CATEGORY_KEY };
  const slices = pickExportSlices({
    aggregationMode: safeAggregationMode,
    context: exportContext,
  });

  let folder = null;
  try {
    folder = await createDocumentFolder({ name: buildFolderName() });

    const persistedSlices = [];
    for (const slice of slices) {
      const payload = buildDocumentServicePayload({
        context: slice.context,
        fieldKeys,
        columnKeys,
        signatures,
        signatureDates,
        signatureBlock: finalSignatureBlock,
      });
      const renderedFile = await renderToDocumentFolder(folder.id, {
        templateId: template.documentServiceTemplateId,
        fileName: slice.fileName,
        sortKey: slice.sortKey,
        fields: payload.fields,
        rows: payload.rows,
        signatures: payload.signatures,
        signatureDates,
        signatureBlock: finalSignatureBlock,
      });
      persistedSlices.push(buildSliceCreateInput({ renderedFile, slice }));
    }

    const data = {
      storageUnitId: Number(storageUnitId),
      periodMonth: safePeriodMonth,
      aggregationMode: safeAggregationMode,
      unitIdsJson: selectedUnitIds,
      pdfTemplateId: template.id,
      documentServiceTemplateId: template.documentServiceTemplateId,
      documentServiceFolderId: Number(folder.id),
      displayName: buildDisplayName(safePeriodMonth, context),
      tongTienThang: sumSliceTongTien(persistedSlices),
      sliceCount: persistedSlices.length,
      sourceDataHash,
      signaturesJson: {
        signatures,
        signatureDates,
        ...(finalSignatureBlock ? { signatureBlock: finalSignatureBlock } : {}),
      },
      updatedById: Number(createdById),
      slices: {
        create: persistedSlices,
      },
    };

    let row;
    if (existingRow) {
      await deleteDocumentFolder(existingRow.documentServiceFolderId);
      await prisma.chungTuBkmhSlice.deleteMany({
        where: { monthlyId: existingRow.id },
      });
      row = await prisma.chungTuBkmhMonthly.update({
        where: { id: existingRow.id },
        data,
        include: {
          slices: {
            orderBy: [{ sortKey: "asc" }, { id: "asc" }],
          },
        },
      });
    } else {
      row = await prisma.chungTuBkmhMonthly.create({
        data: {
          ...data,
          createdById: Number(createdById),
        },
        include: {
          slices: {
            orderBy: [{ sortKey: "asc" }, { id: "asc" }],
          },
        },
      });
    }

    return mapMonthlyRow(row);
  } catch (error) {
    if (folder?.id != null) {
      await deleteDocumentFolder(folder.id).catch(() => {});
    }
    throw error;
  }
}

async function listChungTuBkmhMonthly({ storageUnitId, periodMonth, effectiveUnitIds }) {
  assertStorageUnitInEffectiveBranch(storageUnitId, effectiveUnitIds);
  const where = { storageUnitId: Number(storageUnitId) };
  if (periodMonth) {
    where.periodMonth = normalizePeriodMonth(periodMonth);
  }
  const rows = await prisma.chungTuBkmhMonthly.findMany({
    where,
    include: {
      slices: {
        orderBy: [{ sortKey: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 200,
  });
  return rows.map(mapMonthlyRow);
}

async function getChungTuBkmhMonthly({ id, effectiveUnitIds }) {
  const row = await loadMonthlyRowOrThrow(id);
  assertStorageUnitInEffectiveBranch(row.storageUnitId, effectiveUnitIds);
  return mapMonthlyRow(row);
}

async function deleteChungTuBkmhMonthly({ id, effectiveUnitIds }) {
  const row = await prisma.chungTuBkmhMonthly.findUnique({
    where: { id: Number(id) },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy BKMH tháng.");
  }
  assertStorageUnitInEffectiveBranch(row.storageUnitId, effectiveUnitIds);
  await deleteDocumentFolder(row.documentServiceFolderId);
  await prisma.chungTuBkmhMonthly.delete({
    where: { id: row.id },
  });
  return { id: row.id, deleted: true };
}

async function streamChungTuBkmhMonthlyZip({ id, effectiveUnitIds }) {
  const row = await prisma.chungTuBkmhMonthly.findUnique({
    where: { id: Number(id) },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy BKMH tháng.");
  }
  assertStorageUnitInEffectiveBranch(row.storageUnitId, effectiveUnitIds);
  return streamDocumentFolderZip(row.documentServiceFolderId);
}

async function streamChungTuBkmhMonthlyMergedPdf({ id, effectiveUnitIds }) {
  const row = await prisma.chungTuBkmhMonthly.findUnique({
    where: { id: Number(id) },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy BKMH tháng.");
  }
  assertStorageUnitInEffectiveBranch(row.storageUnitId, effectiveUnitIds);
  return streamDocumentFolderMergedPdf(row.documentServiceFolderId);
}

async function streamChungTuBkmhMonthlySliceFile({ id, sliceId, effectiveUnitIds }) {
  const row = await loadMonthlyRowOrThrow(id);
  assertStorageUnitInEffectiveBranch(row.storageUnitId, effectiveUnitIds);
  const slice = row.slices.find((item) => Number(item.id) === Number(sliceId));
  if (!slice?.documentServiceFileId) {
    throw notFoundError("Không tìm thấy file PDF của dòng BKMH.");
  }
  return streamDocumentFolderFile(row.documentServiceFolderId, slice.documentServiceFileId);
}

export {
  createChungTuBkmhMonthlyExport,
  deleteChungTuBkmhMonthly,
  getChungTuBkmhMonthly,
  listChungTuBkmhMonthly,
  streamChungTuBkmhMonthlyMergedPdf,
  streamChungTuBkmhMonthlySliceFile,
  streamChungTuBkmhMonthlyZip,
};
