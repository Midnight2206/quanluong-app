import crypto from "node:crypto";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  assertKnownCategoryKey,
  CHUNG_TU_CATEGORY_KEYS,
  normalizeAggregationMode,
} from "./chung-tu-category.constants.js";
import { normalizeMonthUnitIds, normalizePeriodMonth, lastDayOfMonth } from "./chung-tu-monthly-sheets.js";
import {
  prepareSignatureBlockForRender,
  resolveChungTuContext,
} from "./chung-tu-data-resolver.service.js";
import { SIGNATURE_CATALOG } from "./chung-tu-signature-catalog.js";
import { buildDocumentServicePayload } from "./chung-tu-pdf-map.util.js";
import { fillSignatureDatesFromPeriod } from "./chung-tu-signature-dates.util.js";
import {
  buildChungTuPdfRelativePath,
  deleteChungTuPdfFile,
  readChungTuPdfFile,
  writeChungTuPdfFile,
} from "./chung-tu-pdf-storage.util.js";
import {
  getTemplateFields,
  renderDocumentPdf,
} from "../../services/document-service.client.js";

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

function extractNamedKeys(items, preferredKeys) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    if (typeof item === "string") {
      const value = item.trim();
      if (value) out.push(value);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    for (const key of preferredKeys) {
      const raw = item[key];
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value) {
        out.push(value);
        break;
      }
    }
  }
  return [...new Set(out)];
}

function extractTemplateKeys(fieldsPayload) {
  const root =
    fieldsPayload && typeof fieldsPayload === "object" ? fieldsPayload : {};
  const container =
    root.data && typeof root.data === "object" ? root.data : root;
  const fieldKeys = extractNamedKeys(container.fields, [
    "field_name",
    "name",
    "key",
    "fieldKey",
    "field_key",
  ]);
  const columnKeys = extractNamedKeys(container.columns, [
    "key",
    "name",
    "fieldKey",
    "field_key",
  ]);
  return { fieldKeys, columnKeys };
}

function buildExportKey() {
  return `ctpdf_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

function buildPdfFileName(categoryKey, exportKey) {
  return `${String(categoryKey).trim()}-${exportKey}.pdf`;
}

function toIsoDateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : null;
}

function mapPdfExportRow(row) {
  const signaturesMeta =
    row.signaturesJson && typeof row.signaturesJson === "object"
      ? row.signaturesJson
      : {};
  return {
    id: row.id,
    exportKey: row.exportKey,
    categoryKey: row.categoryKey,
    unitId: row.unitId,
    periodMonth: row.periodMonth ?? null,
    periodDate: toIsoDateOnly(row.periodDate),
    issueSlipId: row.issueSlipId ?? null,
    unitIds: normalizeMonthUnitIds(row.unitIdsJson),
    aggregationMode: row.aggregationMode ?? null,
    pdfTemplateId: row.pdfTemplateId,
    documentServiceTemplateId: row.documentServiceTemplateId,
    fileName: row.fileName,
    sourceDataHash: row.sourceDataHash ?? null,
    signatures: signaturesMeta.signatures ?? {},
    signatureDates: signaturesMeta.signatureDates ?? {},
    signatureBlock: signaturesMeta.signatureBlock ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    downloadPath: `/chungtuquyettoan/pdf-exports/${row.exportKey}/file`,
  };
}

function buildPeriodDateValue({ meta, periodDate, periodMonth }) {
  if (periodMonth) {
    return new Date(`${periodMonth}-01T00:00:00.000Z`);
  }
  if (meta.mode === "by-date" && periodDate) {
    return new Date(`${periodDate}T00:00:00.000Z`);
  }
  return null;
}

async function createChungTuPdfExport({
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
    ? aggregationMode === "full"
      ? "full"
      : "by-day"
    : safePeriodMonth
      ? normalizeAggregationMode(aggregationMode)
      : undefined;

  const resolveCtx = { storageUnitId: unitId, currentUserId: createdById };
  const resolvedSignatureBlock = await prepareSignatureBlockForRender(signatureBlock, resolveCtx);

  const resolvedBkmhBuyer =
    categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG
      ? await SIGNATURE_CATALOG["bkmh.nguoiMua"]
          .resolve({ storageUnitId: unitId })
          .catch(() => null)
      : null;

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
    resolvedBkmhBuyer,
  };
  if (isPnk) {
    resolveArgs.dateFrom = safeDateFrom || undefined;
    resolveArgs.dateTo = safeDateTo || undefined;
  }
  const { context, sourceDataHash } = await resolveChungTuContext(resolveArgs);

  const fieldsPayload = await getTemplateFields(template.documentServiceTemplateId);
  const { fieldKeys, columnKeys } = extractTemplateKeys(fieldsPayload);
  const fieldLabels =
    template.fieldLabelsJson && typeof template.fieldLabelsJson === "object" && !Array.isArray(template.fieldLabelsJson)
      ? Object.fromEntries(
          Object.entries(template.fieldLabelsJson).map(([key, value]) => [String(key), String(value ?? "")]),
        )
      : {};
  const resolvedSignatureDates = fillSignatureDatesFromPeriod({
    signatureBlock: resolvedSignatureBlock,
    signatureDates,
    context,
    aggregationMode: safeAggregationMode,
    periodMonth: safePeriodMonth,
    lastDayOfMonthFn: lastDayOfMonth,
  });
  const payload = buildDocumentServicePayload({
    context,
    fieldKeys,
    columnKeys,
    fieldLabels,
    signatures,
    signatureDates: resolvedSignatureDates,
    signatureBlock: resolvedSignatureBlock,
  });
  const buffer = await renderDocumentPdf(template.documentServiceTemplateId, payload);

  const exportKey = buildExportKey();
  const year = new Date().getFullYear();
  const storagePath = buildChungTuPdfRelativePath({
    categoryKey,
    exportKey,
    year,
  });
  const fileName = buildPdfFileName(categoryKey, exportKey);
  await writeChungTuPdfFile(storagePath, buffer);

  try {
    const row = await prisma.chungTuPdfExport.create({
      data: {
        exportKey,
        categoryKey,
        unitId: Number(unitId),
        periodMonth: safePeriodMonth ?? null,
        periodDate: buildPeriodDateValue({
          meta,
          periodDate,
          periodMonth: safePeriodMonth,
        }),
        issueSlipId: meta.mode === "by-slip" && !safePeriodMonth ? Number(issueSlipId) : null,
        unitIdsJson: selectedUnitIds ?? [],
        aggregationMode: safeAggregationMode ?? null,
        pdfTemplateId: template.id,
        documentServiceTemplateId: template.documentServiceTemplateId,
        fileName,
        storagePath,
        sourceDataHash,
        signaturesJson: {
          signatures,
          signatureDates,
          ...(signatureBlock ? { signatureBlock } : {}),
        },
        createdById,
      },
    });
    return mapPdfExportRow(row);
  } catch (error) {
    await deleteChungTuPdfFile(storagePath).catch(() => {});
    throw error;
  }
}

async function listChungTuPdfExports({
  unitId,
  categoryKey,
  from,
  to,
  effectiveUnitIds,
}) {
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
  const rows = await prisma.chungTuPdfExport.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
  return rows.map(mapPdfExportRow);
}

async function getChungTuPdfExportFile({ exportKey, effectiveUnitIds }) {
  const row = await prisma.chungTuPdfExport.findUnique({
    where: { exportKey },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy bản xuất PDF.");
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  try {
    const buffer = await readChungTuPdfFile(row.storagePath);
    return { buffer, fileName: row.fileName };
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw notFoundError("Không tìm thấy file PDF đã xuất.");
    }
    throw error;
  }
}

async function deleteChungTuPdfExport({ exportKey, effectiveUnitIds }) {
  const row = await prisma.chungTuPdfExport.findUnique({
    where: { exportKey },
  });
  if (!row) {
    throw notFoundError("Không tìm thấy bản xuất PDF.");
  }
  assertUnitInEffectiveBranch(row.unitId, effectiveUnitIds);
  await deleteChungTuPdfFile(row.storagePath);
  await prisma.chungTuPdfExport.delete({
    where: { id: row.id },
  });
  return { exportKey, deleted: true };
}

export {
  createChungTuPdfExport,
  deleteChungTuPdfExport,
  extractTemplateKeys,
  getChungTuPdfExportFile,
  listChungTuPdfExports,
};
