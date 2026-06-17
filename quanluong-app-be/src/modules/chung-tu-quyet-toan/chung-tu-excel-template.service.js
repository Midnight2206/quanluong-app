import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";
import { resolveChungTuContext } from "./chung-tu-data-resolver.service.js";
import { normalizeMonthUnitIds, normalizePeriodMonth } from "./chung-tu-monthly-sheets.js";
import {
  buildPrintProfileFromWorksheet,
  expandDetailRowsWithCarryRows,
  isCarryDetailRow,
  normalizePaginationConfig,
} from "./chung-tu-excel-print-pagination.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DEFAULT_MAX_XLSX_BYTES = 32 * 1024 * 1024;
const DEFAULT_COLUMNS = ["stt", "tenHang", "dvt", "nguoiBan", "soLuong", "donGia", "thanhTien"];

function cellText(cell) {
  const value = cell?.value;
  if (value == null) return "";
  if (typeof value === "object") {
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return String(value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? "").join("").trim();
    if (value.formula != null) return String(value.formula).trim();
  }
  return String(value).trim();
}

function guessDetailFieldKey(label) {
  const text = String(label ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!text) return "";
  if (/\bstt\b|so thu tu/.test(text)) return "stt";
  if (/ten.*hang|mat hang|hang hoa|thuc pham/.test(text)) return "tenHang";
  if (/dvt|don vi tinh/.test(text)) return "dvt";
  if (/nguoi.*ban|ben ban|nha cung cap/.test(text)) return "nguoiBan";
  if (/so luong|sl\b/.test(text)) return "soLuong";
  if (/don gia|gia\b/.test(text)) return "donGia";
  if (/thanh tien|tong tien|so tien/.test(text)) return "thanhTien";
  if (/ghi chu|dien giai/.test(text)) return "ghiChu";
  return "";
}

function headerRowCandidates(ws) {
  const rows = [];
  const maxRow = Math.min(ws.rowCount || 0, 40);
  const maxCol = Math.min(ws.columnCount || 0, 40);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    const cells = [];
    for (let colNumber = 1; colNumber <= maxCol; colNumber += 1) {
      const text = cellText(row.getCell(colNumber));
      if (!text) continue;
      cells.push({
        col: colNumber,
        address: row.getCell(colNumber).address,
        label: text.slice(0, 120),
        fieldKey: guessDetailFieldKey(text),
      });
    }
    if (cells.length >= 2) rows.push({ rowNumber, cells });
  }
  return rows.slice(0, 12);
}

function assertBkmh(categoryKey) {
  if (categoryKey !== CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG) {
    throw new AppError({
      message: "Luồng Excel local hiện chỉ hỗ trợ Bảng kê mua hàng.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function excelTemplateRootDir() {
  return (
    process.env.CHUNG_TU_EXCEL_TEMPLATE_DIR ||
    path.resolve(process.cwd(), "storage/chung-tu-excel-templates")
  );
}

function safeFilename(input) {
  const base = path.basename(String(input || "template.xlsx")).replace(/\0/g, "");
  const normalized = base.normalize("NFC").replace(/[^\p{L}\p{N}._ -]+/gu, "_").trim();
  const withExt = /\.xlsx$/i.test(normalized) ? normalized : `${normalized || "template"}.xlsx`;
  return withExt.slice(0, 180);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertXlsxUpload({ buffer, originalFilename, mimetype, size }) {
  if (!buffer?.length) {
    throw new AppError({
      message: "Thiếu file Excel upload.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (Number(size ?? buffer.length) > DEFAULT_MAX_XLSX_BYTES) {
    throw new AppError({
      message: "File Excel tối đa 32MB.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (!/\.xlsx$/i.test(String(originalFilename ?? ""))) {
    throw new AppError({
      message: "Chỉ chấp nhận file .xlsx.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (mimetype && mimetype !== XLSX_MIME && mimetype !== "application/octet-stream") {
    throw new AppError({
      message: "MIME type file Excel không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function loadWorkbookFromBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

async function loadWorkbookFromFile(storagePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(storagePath);
  return workbook;
}

function definedNamesMetadata(workbook) {
  const model = Array.isArray(workbook.definedNames?.model) ? workbook.definedNames.model : [];
  return model.map((item) => ({
    name: item.name ?? "",
    ranges: Array.isArray(item.ranges) ? item.ranges : [],
  }));
}

function worksheetMetadata(ws) {
  const merges = ws._merges && typeof ws._merges === "object" ? Object.keys(ws._merges) : [];
  return {
    id: ws.id,
    name: ws.name,
    rowCount: ws.rowCount,
    columnCount: ws.columnCount,
    actualRowCount: ws.actualRowCount,
    actualColumnCount: ws.actualColumnCount,
    mergedCells: merges,
    views: ws.views ?? [],
    pageSetup: ws.pageSetup ?? {},
    pageMargins: ws.pageMargins ?? {},
    headerRows: headerRowCandidates(ws),
    dimensions: {
      top: ws.dimensions?.top ?? null,
      left: ws.dimensions?.left ?? null,
      bottom: ws.dimensions?.bottom ?? null,
      right: ws.dimensions?.right ?? null,
    },
  };
}

function parseWorkbookMetadata(workbook) {
  return {
    sheets: workbook.worksheets.map(worksheetMetadata),
    definedNames: definedNamesMetadata(workbook),
    created: workbook.created?.toISOString?.() ?? null,
    modified: workbook.modified?.toISOString?.() ?? null,
  };
}

function mapTemplateRow(row) {
  return {
    id: row.id,
    categoryKey: row.categoryKey,
    displayName: row.displayName,
    originalFilename: row.originalFilename,
    fileSize: row.fileSize,
    checksum: row.checksum,
    metadata: row.metadataJson ?? {},
    mapping: row.mappingJson ?? null,
    isActive: row.isActive,
    createdById: row.createdById,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

function metadataHasHeaderRows(metadata) {
  return Array.isArray(metadata?.sheets) && metadata.sheets.some((sheet) => Array.isArray(sheet.headerRows));
}

async function ensureTemplateMetadata(row) {
  if (!row || metadataHasHeaderRows(row.metadataJson)) return row;
  try {
    const workbook = await loadWorkbookFromFile(row.storagePath);
    const metadata = parseWorkbookMetadata(workbook);
    return await prisma.chungTuExcelTemplate.update({
      where: { id: row.id },
      data: {
        metadataJson: metadata,
        mappingJson: row.mappingJson ?? defaultMappingFromMetadata(metadata),
      },
    });
  } catch {
    return row;
  }
}

function mapHistoryRow(row) {
  return {
    id: row.id,
    templateId: row.templateId,
    templateName: row.template?.displayName ?? null,
    categoryKey: row.categoryKey,
    periodMonth: row.periodMonth,
    unitIds: Array.isArray(row.unitIdsJson) ? row.unitIdsJson : [],
    lineCount: row.lineCount,
    totalAmount: Number(row.totalAmount ?? 0),
    metadata: row.metadataJson ?? {},
    createdById: row.createdById,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  };
}

async function saveTemplateFile({ buffer, categoryKey, checksum, originalFilename }) {
  const dir = path.join(excelTemplateRootDir(), categoryKey);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${checksum.slice(0, 12)}-${safeFilename(originalFilename)}`;
  const storagePath = path.join(dir, filename);
  await fs.writeFile(storagePath, buffer, { flag: "wx" });
  return storagePath;
}

async function createExcelTemplate({ categoryKey, displayName, buffer, originalFilename, mimetype, size, createdById }) {
  assertBkmh(categoryKey);
  assertXlsxUpload({ buffer, originalFilename, mimetype, size });
  const workbook = await loadWorkbookFromBuffer(buffer);
  const metadata = parseWorkbookMetadata(workbook);
  const checksum = sha256(buffer);
  const storagePath = await saveTemplateFile({ buffer, categoryKey, checksum, originalFilename });
  const row = await prisma.chungTuExcelTemplate.create({
    data: {
      categoryKey,
      displayName: String(displayName ?? "").trim().slice(0, 200) || safeFilename(originalFilename),
      originalFilename: safeFilename(originalFilename),
      storagePath,
      fileSize: buffer.length,
      checksum,
      metadataJson: metadata,
      mappingJson: defaultMappingFromMetadata(metadata),
      createdById,
    },
  });
  return mapTemplateRow(row);
}

async function listExcelTemplates({ categoryKey }) {
  assertBkmh(categoryKey);
  const rows = await prisma.chungTuExcelTemplate.findMany({
    where: { categoryKey },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
  const refreshed = await Promise.all(rows.map(ensureTemplateMetadata));
  return refreshed.map(mapTemplateRow);
}

async function getExcelTemplateMetadata({ id }) {
  let row = await prisma.chungTuExcelTemplate.findUnique({ where: { id: Number(id) } });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy template Excel.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  row = await ensureTemplateMetadata(row);
  return mapTemplateRow(row);
}

async function updateExcelTemplateMapping({ id, mapping, isActive }) {
  const row = await prisma.chungTuExcelTemplate.update({
    where: { id: Number(id) },
    data: {
      ...(mapping !== undefined ? { mappingJson: normalizeMapping(mapping) } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  });
  return mapTemplateRow(row);
}

function defaultMappingFromMetadata(metadata) {
  const firstSheet = metadata.sheets?.[0]?.name ?? "";
  const bestHeader =
    metadata.sheets?.[0]?.headerRows?.find((row) =>
      row.cells?.some((cell) => cell.fieldKey === "tenHang" || cell.fieldKey === "thanhTien"),
    ) ?? metadata.sheets?.[0]?.headerRows?.[0];
  const columns = bestHeader?.cells?.length
    ? bestHeader.cells.map((cell) => ({
        col: cell.col,
        label: cell.label,
        fieldKey: cell.fieldKey,
      }))
    : DEFAULT_COLUMNS.map((fieldKey, index) => ({ col: index + 1, fieldKey }));
  return {
    version: 1,
    fieldTargets: [],
    table: {
      sheetName: firstSheet,
      headerRow: bestHeader?.rowNumber ?? 8,
      startRow: bestHeader?.rowNumber ? bestHeader.rowNumber + 1 : 9,
      templateRow: bestHeader?.rowNumber ? bestHeader.rowNumber + 1 : 9,
      startCol: 1,
      columns,
    },
    pagination: {
      enabled: true,
      amountFieldKey: "thanhTien",
      labelFieldKey: "tenHang",
      carryInLabel: "Mang sang",
      carryOutLabel: "Cộng sang trang",
    },
  };
}

function normalizeMapping(mapping) {
  const raw = mapping && typeof mapping === "object" && !Array.isArray(mapping) ? mapping : {};
  const table = raw.table && typeof raw.table === "object" && !Array.isArray(raw.table) ? raw.table : {};
  const pagination = normalizePaginationConfig(
    table,
    raw.pagination && typeof raw.pagination === "object" && !Array.isArray(raw.pagination) ? raw.pagination : {},
  );
  return {
    version: 1,
    fieldTargets: [],
    table: {
      sheetName: String(table.sheetName ?? "").trim(),
      headerRow: Math.max(1, Number(table.headerRow) || 8),
      startRow: Math.max(1, Number(table.startRow) || 9),
      templateRow: Math.max(1, Number(table.templateRow) || Number(table.startRow) || 9),
      startCol: Math.max(1, Number(table.startCol) || 1),
      columns: (Array.isArray(table.columns) ? table.columns : [])
        .map((item, index) => ({
          col: Math.max(1, Number(item?.col) || index + 1),
          label: item?.label != null ? String(item.label).trim().slice(0, 120) : "",
          fieldKey: String(item?.fieldKey ?? "").trim(),
        }))
        .filter((item) => item.col > 0),
    },
    pagination,
  };
}

function copyRowStyle(sourceRow, targetRow) {
  sourceRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const target = targetRow.getCell(colNumber);
    target.style = JSON.parse(JSON.stringify(cell.style ?? {}));
    target.numFmt = cell.numFmt;
    target.alignment = cell.alignment ? { ...cell.alignment } : undefined;
    target.border = cell.border ? { ...cell.border } : undefined;
    target.fill = cell.fill ? { ...cell.fill } : undefined;
  });
  targetRow.height = sourceRow.height;
}

function clonePlain(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function copyWorksheet(source, target) {
  target.properties = { ...(source.properties ?? {}) };
  target.pageSetup = clonePlain(source.pageSetup ?? {});
  target.pageMargins = clonePlain(source.pageMargins ?? {});
  target.headerFooter = clonePlain(source.headerFooter ?? {});
  target.views = clonePlain(source.views ?? []);
  target.state = source.state;

  source.columns?.forEach((column, index) => {
    const targetColumn = target.getColumn(index + 1);
    targetColumn.width = column.width;
    targetColumn.hidden = column.hidden;
    targetColumn.outlineLevel = column.outlineLevel;
    targetColumn.style = clonePlain(column.style ?? {});
  });

  source.eachRow({ includeEmpty: true }, (sourceRow, rowNumber) => {
    const targetRow = target.getRow(rowNumber);
    targetRow.height = sourceRow.height;
    targetRow.hidden = sourceRow.hidden;
    targetRow.outlineLevel = sourceRow.outlineLevel;
    sourceRow.eachCell({ includeEmpty: true }, (sourceCell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = clonePlain(sourceCell.value);
      targetCell.style = clonePlain(sourceCell.style ?? {});
      targetCell.numFmt = sourceCell.numFmt;
      targetCell.alignment = clonePlain(sourceCell.alignment);
      targetCell.border = clonePlain(sourceCell.border);
      targetCell.fill = clonePlain(sourceCell.fill);
      targetCell.protection = clonePlain(sourceCell.protection);
      targetCell.note = clonePlain(sourceCell.note);
    });
  });

  const merges = source._merges && typeof source._merges === "object" ? Object.keys(source._merges) : [];
  for (const range of merges) {
    try {
      target.mergeCells(range);
    } catch {
      // Ignore duplicate/invalid merge metadata from third-party workbooks.
    }
  }
}

function ensureDailyWorksheets(workbook, tableMapping, sheetContexts) {
  if (!Array.isArray(sheetContexts) || sheetContexts.length === 0) return;
  const dayNames = sheetContexts.map((ctx) => String(ctx.sheetName ?? "").trim()).filter(Boolean);
  if (!dayNames.length) return;

  const templateSheet = workbook.getWorksheet(tableMapping.sheetName) || workbook.worksheets[0];
  if (!templateSheet) return;
  const templateName = templateSheet.name;

  for (const dayName of dayNames) {
    if (workbook.getWorksheet(dayName)) continue;
    const ws = workbook.addWorksheet(dayName);
    copyWorksheet(templateSheet, ws);
  }

  if (!dayNames.includes(templateName) && workbook.worksheets.length > dayNames.length) {
    workbook.removeWorksheet(templateSheet.id);
  }
}

function fillTableRows(ws, tableMapping, detailRows, pagination = {}) {
  const startRow = Number(tableMapping.startRow);
  const templateRow = Number(tableMapping.templateRow || startRow);
  const sourceStyleRow = ws.getRow(templateRow);
  const printProfile = buildPrintProfileFromWorksheet(ws, tableMapping, pagination);
  const rows = expandDetailRowsWithCarryRows(detailRows, printProfile);
  if (rows.length > 1) {
    ws.spliceRows(startRow + 1, 0, ...Array.from({ length: rows.length - 1 }, () => []));
  }
  rows.forEach((row, index) => {
    const excelRow = ws.getRow(startRow + index);
    copyRowStyle(sourceStyleRow, excelRow);
    for (const col of tableMapping.columns ?? []) {
      if (!col.fieldKey) continue;
      excelRow.getCell(Number(col.col)).value = row[col.fieldKey] ?? "";
    }
    if (isCarryDetailRow(row)) {
      for (const col of tableMapping.columns ?? []) {
        if (!col.fieldKey || row[col.fieldKey] == null || row[col.fieldKey] === "") continue;
        const cell = excelRow.getCell(Number(col.col));
        cell.font = { ...(cell.font ?? {}), bold: true };
      }
    }
    excelRow.commit?.();
  });
}

function fillWorkbookForContext({ workbook, context, mapping }) {
  const table = mapping.table;
  const pagination = mapping.pagination ?? {};
  const sheetContexts = Array.isArray(context.sheetContexts) ? context.sheetContexts : [];
  const contexts = sheetContexts.length ? sheetContexts : [context];
  ensureDailyWorksheets(workbook, table, sheetContexts);
  for (const ctx of contexts) {
    const sheetName = ctx.sheetName && workbook.getWorksheet(ctx.sheetName) ? ctx.sheetName : table.sheetName;
    const ws = workbook.getWorksheet(sheetName) || workbook.worksheets[0];
    if (!ws) continue;
    fillTableRows(ws, table, ctx.detailRows ?? [], pagination);
  }
}

async function exportBkmhExcel({ templateId, unitId, periodMonth, unitIds, settings, createdById, effectiveUnitIds }) {
  const template = await prisma.chungTuExcelTemplate.findUnique({ where: { id: Number(templateId) } });
  if (!template || !template.isActive) {
    throw new AppError({
      message: "Không tìm thấy template Excel đang hoạt động.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertBkmh(template.categoryKey);
  const selectedUnitIds = normalizeMonthUnitIds(unitIds);
  if (!selectedUnitIds.length) {
    throw new AppError({
      message: "Cần chọn ít nhất một đơn vị để xuất BKMH Excel.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (effectiveUnitIds?.length) {
    const allowed = new Set(effectiveUnitIds.map(Number));
    if (!selectedUnitIds.every((id) => allowed.has(Number(id)))) {
      throw new AppError({
        message: "Đơn vị nằm ngoài phạm vi được phép.",
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
      });
    }
  }
  let safeMonth;
  try {
    safeMonth = normalizePeriodMonth(periodMonth);
  } catch {
    throw new AppError({
      message: "periodMonth phải dạng YYYY-MM.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const { context } = await resolveChungTuContext({
    categoryKey: template.categoryKey,
    unitId,
    periodMonth: safeMonth,
    unitIds: selectedUnitIds,
    settings: {},
  });
  const workbook = await loadWorkbookFromFile(template.storagePath);
  const mapping = normalizeMapping(template.mappingJson ?? defaultMappingFromMetadata(template.metadataJson));
  fillWorkbookForContext({ workbook, context, mapping });
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const history = await prisma.chungTuExcelExportHistory.create({
    data: {
      templateId: template.id,
      categoryKey: template.categoryKey,
      periodMonth: safeMonth,
      unitIdsJson: selectedUnitIds,
      lineCount: Number(context.lineCount ?? context.detailRows?.length ?? 0),
      totalAmount: Number(context.tongTienSo ?? 0),
      metadataJson: {
        templateName: template.displayName,
        slipCount: context.slipCount ?? 0,
      },
      createdById,
    },
  });
  return {
    buffer,
    filename: `bang-ke-mua-hang-${safeMonth}.xlsx`,
    history: mapHistoryRow({ ...history, template }),
  };
}

async function listExcelExportHistory({ categoryKey }) {
  assertBkmh(categoryKey);
  const rows = await prisma.chungTuExcelExportHistory.findMany({
    where: { categoryKey },
    include: { template: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(mapHistoryRow);
}

export {
  fillWorkbookForContext,
  createExcelTemplate,
  exportBkmhExcel,
  getExcelTemplateMetadata,
  listExcelExportHistory,
  listExcelTemplates,
  normalizeMapping,
  parseWorkbookMetadata,
  updateExcelTemplateMapping,
};
