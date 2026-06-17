import { google } from "googleapis";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { assertTemplateInCategoryFolder } from "./chung-tu-drive-folders.service.js";
import { normalizeFillRulesV2 } from "./chung-tu-quyet-toan.service.js";
import { getContextFieldRegistryForCategory } from "./chung-tu-context-field-registry.js";
import { CHUNG_TU_DEFAULT_SHEET_TABLE } from "./chung-tu-category.constants.js";

const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";

const CONTEXT_DERIVED_FIELDS = Object.freeze([
  { fieldKey: "ngay", label: "Ngày (dd)" },
  { fieldKey: "thang", label: "Tháng (mm)" },
  { fieldKey: "nam", label: "Năm (yyyy)" },
  { fieldKey: "ngayThangNam", label: "Ngày tháng năm (Ngày dd tháng mm năm yyyy)" },
  { fieldKey: "ngayChungTu", label: "Ngày chứng từ (YYYY-MM-DD)" },
  { fieldKey: "so", label: "Số chứng từ (alias ngắn)" },
  { fieldKey: "soChungTu", label: "Số chứng từ" },
  { fieldKey: "quyenSo", label: "Quyển số" },
  { fieldKey: "tongTien", label: "Tổng tiền (định dạng)" },
  { fieldKey: "tongTienBangChu", label: "Tổng tiền bằng chữ" },
  { fieldKey: "recipientDisplayName", label: "Người nhận (phiếu xuất)" },
  { fieldKey: "warehouseFrom", label: "Xuất tại kho" },
  { fieldKey: "printLine2", label: "Dòng in 2" },
]);

function assertFillRulesObject(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({
      message: "fillRules phải là object JSON.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function buildKnownFieldKeys(registry) {
  const keys = new Set();
  for (const f of registry.formFields ?? []) {
    if (f.fieldKey) keys.add(f.fieldKey);
  }
  for (const f of CONTEXT_DERIVED_FIELDS) {
    keys.add(f.fieldKey);
  }
  for (const t of registry.dbTables ?? []) {
    for (const c of t.columns ?? []) {
      if (c.fieldKeyHint) keys.add(c.fieldKeyHint);
    }
  }
  return keys;
}

function defaultDetailTableForCategory(categoryKey) {
  const def = CHUNG_TU_DEFAULT_SHEET_TABLE[categoryKey];
  if (!def) return null;
  return {
    sheetName: "",
    startRow: def.startRow,
    startCol: def.startCol,
    columns: [...def.columns],
    repeatHeaderEveryRows: Number(def.repeatHeaderEveryRows ?? 0),
    repeatHeaderLabels: Array.isArray(def.repeatHeaderLabels) ? [...def.repeatHeaderLabels] : [],
    pageRowsFirst: Number(def.repeatHeaderEveryRows ?? 0),
    pageRowsNext: Number(def.repeatHeaderEveryRows ?? 0),
    amountFieldKey: "thanhTien",
    labelFieldKey: "tenHang",
    carryInLabel: "Mang sang",
    carryOutLabel: "Cộng sang trang",
  };
}

function applyDefaultDetailTableOptions(fillRules, categoryKey) {
  const normalized = normalizeFillRulesV2(fillRules, "spreadsheet");
  const def = defaultDetailTableForCategory(categoryKey);
  if (!def) return normalized;
  const table = normalized.sheets?.detailTable;
  if (!table) {
    normalized.sheets.detailTable = def;
    return normalized;
  }
  normalized.sheets.detailTable = {
    ...table,
    repeatHeaderEveryRows:
      Number.isFinite(Number(table.repeatHeaderEveryRows)) && Number(table.repeatHeaderEveryRows) > 0
        ? Number(table.repeatHeaderEveryRows)
        : Number(def.repeatHeaderEveryRows ?? 0),
    repeatHeaderLabels:
      Array.isArray(table.repeatHeaderLabels) && table.repeatHeaderLabels.length
        ? table.repeatHeaderLabels
        : def.repeatHeaderLabels,
    pageRowsFirst:
      Number.isFinite(Number(table.pageRowsFirst)) && Number(table.pageRowsFirst) > 0
        ? Number(table.pageRowsFirst)
        : Number(def.pageRowsFirst ?? 0),
    pageRowsNext:
      Number.isFinite(Number(table.pageRowsNext)) && Number(table.pageRowsNext) > 0
        ? Number(table.pageRowsNext)
        : Number(def.pageRowsNext ?? 0),
    amountFieldKey: table.amountFieldKey || def.amountFieldKey,
    labelFieldKey: table.labelFieldKey || def.labelFieldKey,
    carryInLabel: table.carryInLabel || def.carryInLabel,
    carryOutLabel: table.carryOutLabel || def.carryOutLabel,
  };
  return normalized;
}

const SIGNER_CHAR_GRID_FIELD_KEYS = new Set([
  "nguoiMua",
  "phuTrachBoPhan",
  "taiChinh",
  "thuTruongDonVi",
  "signerNguoiMua",
  "signerPhuTrachBoPhan",
  "signerTaiChinh",
  "signerApprover",
]);

function namedRangeColCountFromItem(item) {
  const g = item?.grid;
  if (!g) return 1;
  const start = Number(g.startColumnIndex ?? 0);
  const end = Number(g.endColumnIndex ?? start + 1);
  return Math.max(1, end - start);
}

function suggestNamedRangeMappings(namedRangeItems, fieldKeys) {
  return (namedRangeItems ?? []).map((nr) => {
    const name = String(nr.name ?? "").trim();
    const colCount = namedRangeColCountFromItem(nr);
    const match = [...fieldKeys].find((k) => k.toLowerCase() === name.toLowerCase());
    const gridByPrefix = /^grid_/i.test(name);
    const useCharGrid =
      colCount > 1 &&
      (gridByPrefix || (match && SIGNER_CHAR_GRID_FIELD_KEYS.has(match)));
    return {
      rangeName: name,
      sheetName: nr.sheetTitle ?? "",
      rule: useCharGrid ? "charGrid" : "field",
      fieldKey: match ?? "",
      value: "",
    };
  });
}

function mergeMissingNamedRangeMappings(fillRules, namedRangeItems, fieldKeys) {
  const normalized = normalizeFillRulesV2(fillRules, "spreadsheet");
  const existing = new Set(
    (normalized.sheets?.namedRanges ?? [])
      .map((item) => String(item.rangeName ?? "").trim())
      .filter(Boolean),
  );
  const additions = suggestNamedRangeMappings(
    (namedRangeItems ?? []).filter((item) => {
      const name = String(item.name ?? "").trim();
      return name && !existing.has(name);
    }),
    fieldKeys,
  );
  if (!additions.length) return normalized;
  return {
    ...normalized,
    sheets: {
      ...normalized.sheets,
      namedRanges: [...(normalized.sheets?.namedRanges ?? []), ...additions],
    },
  };
}

async function fetchSpreadsheetNamedRanges(oauth2Client, driveFileId, fileName) {
  const sheetsApi = google.sheets({ version: "v4", auth: oauth2Client });
  let res;
  try {
    res = await sheetsApi.spreadsheets.get({
      spreadsheetId: driveFileId,
      fields: "properties.title,namedRanges,sheets.properties(sheetId,title,hidden)",
    });
  } catch (error) {
    const status = error?.response?.status;
    const reason = error?.response?.data?.error?.errors?.[0]?.reason;
    if (status === 403 || reason === "PERMISSION_DENIED") {
      throw new AppError({
        message:
          "Không đọc được Google Sheets (kiểm tra OAuth hệ thống CHUNG_TU_SYSTEM_DRIVE_REFRESH_TOKEN).",
        statusCode: 403,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (status === 404) {
      throw new AppError({
        message: "Không tìm thấy file Google Spreadsheet.",
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    throw error;
  }

  const sheetIdToTitle = new Map();
  for (const sh of res.data.sheets ?? []) {
    const sid = sh.properties?.sheetId;
    if (sid != null) {
      sheetIdToTitle.set(Number(sid), String(sh.properties?.title ?? ""));
    }
  }

  const items = (res.data.namedRanges ?? []).map((nr) => {
    const range = nr.range ?? {};
    const sheetId = range.sheetId != null ? Number(range.sheetId) : null;
    return {
      namedRangeId: nr.namedRangeId ?? null,
      name: nr.name ?? "",
      sheetId,
      sheetTitle:
        sheetId != null && !Number.isNaN(sheetId) ? (sheetIdToTitle.get(sheetId) ?? "") : "",
      grid: {
        startRowIndex: range.startRowIndex ?? null,
        endRowIndex: range.endRowIndex ?? null,
        startColumnIndex: range.startColumnIndex ?? null,
        endColumnIndex: range.endColumnIndex ?? null,
      },
    };
  });

  return {
    driveFileId,
    spreadsheetTitle: res.data.properties?.title ?? fileName ?? null,
    items,
  };
}

/** Ưu tiên: FillConfig → catalog link → mặc định bảng chi tiết. */
export async function loadFillRulesForCategoryTemplate(templateDriveFileId, categoryKey) {
  const registry = getContextFieldRegistryForCategory(categoryKey);
  const fieldKeys = buildKnownFieldKeys(registry);
  let namedRangesPayload = null;
  async function fetchTemplateNamedRangesForMerge() {
    if (namedRangesPayload) return namedRangesPayload;
    const { oauth2Client, meta } = await assertTemplateInCategoryFolder({
      categoryKey,
      driveFileId: templateDriveFileId,
    });
    if (meta.mimeType !== GOOGLE_SHEET_MIME) {
      namedRangesPayload = { items: [] };
      return namedRangesPayload;
    }
    namedRangesPayload = await fetchSpreadsheetNamedRanges(
      oauth2Client,
      templateDriveFileId,
      meta.name,
    );
    return namedRangesPayload;
  }

  const cfg = await prisma.chungTuTemplateFillConfig.findUnique({
    where: {
      categoryKey_driveFileId: {
        categoryKey,
        driveFileId: templateDriveFileId,
      },
    },
    select: { fillRulesJson: true },
  });
  if (cfg?.fillRulesJson) {
    const payload = await fetchTemplateNamedRangesForMerge();
    return applyDefaultDetailTableOptions(
      mergeMissingNamedRangeMappings(cfg.fillRulesJson, payload.items, fieldKeys),
      categoryKey,
    );
  }

  const catalog = await prisma.chungTuDriveTemplateLink.findFirst({
    where: { driveFileId: templateDriveFileId, categoryKey, isActive: true },
    select: { fillRulesJson: true },
  });
  if (catalog?.fillRulesJson) {
    const payload = await fetchTemplateNamedRangesForMerge();
    return applyDefaultDetailTableOptions(
      mergeMissingNamedRangeMappings(catalog.fillRulesJson, payload.items, fieldKeys),
      categoryKey,
    );
  }

  const fillRules = normalizeFillRulesV2(null, "spreadsheet");
  const payload = await fetchTemplateNamedRangesForMerge();
  fillRules.sheets.namedRanges = suggestNamedRangeMappings(payload.items, fieldKeys);
  const detailTable = defaultDetailTableForCategory(categoryKey);
  if (detailTable) {
    fillRules.sheets.detailTable = detailTable;
  }
  return applyDefaultDetailTableOptions(fillRules, categoryKey);
}

export async function getCategoryTemplateFillMapping({ categoryKey, driveFileId }) {
  const { oauth2Client, meta } = await assertTemplateInCategoryFolder({
    categoryKey,
    driveFileId,
  });
  if (meta.mimeType !== GOOGLE_SHEET_MIME) {
    throw new AppError({
      message: "Chỉ map dữ liệu cho mẫu Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const registry = getContextFieldRegistryForCategory(categoryKey);
  const fieldKeys = buildKnownFieldKeys(registry);

  const saved = await prisma.chungTuTemplateFillConfig.findUnique({
    where: {
      categoryKey_driveFileId: { categoryKey, driveFileId },
    },
  });

  const namedRangesPayload = await fetchSpreadsheetNamedRanges(
    oauth2Client,
    driveFileId,
    meta.name,
  );

  let fillRules;
  const hasSavedConfig = Boolean(saved?.fillRulesJson);
  if (hasSavedConfig) {
    fillRules = applyDefaultDetailTableOptions(
      mergeMissingNamedRangeMappings(saved.fillRulesJson, namedRangesPayload.items, fieldKeys),
      categoryKey,
    );
  } else {
    fillRules = normalizeFillRulesV2(
      {
        version: 2,
        workspaceKind: "spreadsheet",
        sheets: {
          namedRanges: suggestNamedRangeMappings(namedRangesPayload.items, fieldKeys),
          detailTable: defaultDetailTableForCategory(categoryKey),
        },
      },
      "spreadsheet",
    );
  }

  return {
    categoryKey,
    driveFileId,
    driveFileName: meta.name ?? null,
    webViewLink: meta.webViewLink ?? null,
    hasSavedConfig,
    fillRules,
    namedRanges: namedRangesPayload.items,
    fieldRegistry: {
      ...registry,
      derivedFields: [...CONTEXT_DERIVED_FIELDS],
    },
  };
}

export async function putCategoryTemplateFillMapping({
  categoryKey,
  driveFileId,
  fillRules,
  updatedById,
}) {
  const { meta } = await assertTemplateInCategoryFolder({ categoryKey, driveFileId });
  if (meta.mimeType !== GOOGLE_SHEET_MIME) {
    throw new AppError({
      message: "Chỉ lưu map cho mẫu Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  assertFillRulesObject(fillRules);
  const normalized = normalizeFillRulesV2(fillRules, "spreadsheet");

  const row = await prisma.chungTuTemplateFillConfig.upsert({
    where: {
      categoryKey_driveFileId: { categoryKey, driveFileId },
    },
    create: {
      categoryKey,
      driveFileId,
      templateName: meta.name ?? null,
      fillRulesJson: normalized,
      updatedById: updatedById ?? null,
    },
    update: {
      templateName: meta.name ?? null,
      fillRulesJson: normalized,
      updatedById: updatedById ?? null,
    },
  });

  return {
    categoryKey,
    driveFileId,
    driveFileName: meta.name ?? null,
    hasSavedConfig: true,
    fillRules: normalizeFillRulesV2(row.fillRulesJson, "spreadsheet"),
    updatedAt: row.updatedAt,
  };
}

export async function listCategoryTemplateNamedRanges({ categoryKey, driveFileId }) {
  const { oauth2Client, meta } = await assertTemplateInCategoryFolder({
    categoryKey,
    driveFileId,
  });
  if (meta.mimeType !== GOOGLE_SHEET_MIME) {
    throw new AppError({
      message: "Chỉ đọc Named range từ Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return fetchSpreadsheetNamedRanges(oauth2Client, driveFileId, meta.name);
}
