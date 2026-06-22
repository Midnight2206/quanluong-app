import path from "node:path";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { logger } from "../../shared/utils/logger.js";
import { createDriveClient } from "../../shared/utils/google-drive-fetch.api.js";
import { createSheetsClient } from "../../shared/utils/google-sheets-fetch.api.js";
import { CHUNG_TU_DEFAULT_SHEET_PRINT } from "./chung-tu-category.constants.js";
import {
  getOAuthClient,
  getUserChungTuDriveContext,
} from "../auth/google-drive-link.service.js";
import { resolveCategoryFolderId } from "./chung-tu-drive-folders.service.js";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const TEMPLATE_LIST_MIMES = [GOOGLE_DOC_MIME, GOOGLE_SHEET_MIME];

const MAX_IMPORT_BYTES = 32 * 1024 * 1024;

const EXT_TO_CONVERSION = {
  ".pdf": {
    sourceMime: "application/pdf",
    targetMime: GOOGLE_DOC_MIME,
  },
  ".doc": {
    sourceMime: "application/msword",
    targetMime: GOOGLE_DOC_MIME,
  },
  ".docx": {
    sourceMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    targetMime: GOOGLE_DOC_MIME,
  },
  ".xls": {
    sourceMime: "application/vnd.ms-excel",
    targetMime: GOOGLE_SHEET_MIME,
  },
  ".xlsx": {
    sourceMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    targetMime: GOOGLE_SHEET_MIME,
  },
};

function safeBasename(name) {
  const base = path.basename(String(name || "upload")).replace(/\0/g, "");
  if (!base || base === "." || base === "..") {
    return "upload";
  }
  return base.slice(0, 200);
}

function titleFromOriginalFilename(filename) {
  const base = safeBasename(filename);
  const noExt = base.replace(/\.[^/.]+$/, "").trim();
  return noExt || base;
}

/** Chuẩn hóa Unicode (tiếng Việt) trước khi gửi metadata sang Google Drive */
function normalizeDocumentTitle(input) {
  if (typeof input !== "string") {
    return "";
  }
  return input.normalize("NFC").trim().slice(0, 200);
}

function assertAllowedExtension(ext) {
  return Boolean(EXT_TO_CONVERSION[ext]);
}

function isPdfBuffer(buffer) {
  if (!buffer || buffer.length < 4) {
    return false;
  }
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

/**
 * Resumable upload (Drive v3) — hỗ trợ file > 5MB; kèm chuyển đổi nếu metadata có mimeType Workspace.
 * @see https://developers.google.com/drive/api/guides/manage-uploads
 */
async function driveResumableCreateUpload(oauth2Client, { metadata, sourceMime, buffer }) {
  let accessToken = oauth2Client.credentials?.access_token;
  if (!accessToken) {
    const tokenResponse = await oauth2Client.getAccessToken();
    accessToken = tokenResponse?.token;
  }
  if (!accessToken) {
    throw new AppError({
      message: "Không lấy được access token Google.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  const initUrl =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=false";
  const initRes = await fetch(initUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": sourceMime,
      "X-Upload-Content-Length": String(buffer.length),
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    logger.warn({ status: initRes.status, text }, "Drive resumable init failed");
    throw new AppError({
      message: "Google Drive từ chối tạo phiên tải file.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      details: text.slice(0, 500),
    });
  }

  const location = initRes.headers.get("Location");
  if (!location) {
    throw new AppError({
      message: "Drive không trả về URL tiếp tục tải file.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  const putRes = await fetch(location, {
    method: "PUT",
    headers: {
      "Content-Length": String(buffer.length),
      "Content-Type": sourceMime,
    },
    body: buffer,
  });

  const putText = await putRes.text();
  if (!putRes.ok) {
    logger.warn({ status: putRes.status, putText }, "Drive resumable PUT failed");
    throw new AppError({
      message: "Không tải xong nội dung file lên Google Drive.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      details: putText.slice(0, 500),
    });
  }

  try {
    return JSON.parse(putText);
  } catch {
    throw new AppError({
      message: "Drive trả về phản hồi không hợp lệ sau khi tải file.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

function assertJsonObject(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({
      message: "fillRules phải là object JSON.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function templateKindFromMime(mimeType) {
  return mimeType === GOOGLE_SHEET_MIME ? "spreadsheet" : "document";
}

function createEmptyFillRulesV2(templateKind = "document") {
  return {
    version: 2,
    docs: {
      placeholders: [],
      regions: [],
    },
    sheets: {
      namedRanges: [],
      detailTable: null,
    },
    print: {
      sheets: {
        rowHeightPt: CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt,
      },
    },
    meta: {
      templateKind: templateKind === "spreadsheet" ? "spreadsheet" : "document",
    },
  };
}

function normalizeFillRulesV2(raw, templateKind = "document") {
  const safeKind = templateKind === "spreadsheet" ? "spreadsheet" : "document";
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return createEmptyFillRulesV2(safeKind);
  }
  const toArray = (v) => (Array.isArray(v) ? v : []);
  const toString = (v) => (typeof v === "string" ? v : "");
  const normalizePlaceholder = (x) => ({
    token: toString(x?.token),
    rule: x?.rule === "static" ? "static" : "field",
    fieldKey: toString(x?.fieldKey),
    value: toString(x?.value),
  });
  const normalizeRegion = (x) => ({
    tableSource: {
      dbTable: toString(x?.tableSource?.dbTable),
      startRow: Number.isFinite(Number(x?.tableSource?.startRow)) ? Number(x.tableSource.startRow) : 2,
      startCol: Number.isFinite(Number(x?.tableSource?.startCol)) ? Number(x.tableSource.startCol) : 1,
      columns: toArray(x?.tableSource?.columns).map((col) => ({
        column: toString(col?.column),
        rule: col?.rule === "static" ? "static" : "field",
        fieldKey: toString(col?.fieldKey),
        value: toString(col?.value),
      })),
    },
    id: toString(x?.id),
    label: toString(x?.label),
    anchorStart: toString(x?.anchorStart),
    anchorEnd: toString(x?.anchorEnd),
    mode: toString(x?.mode) || "table",
  });
  const normalizeNamedRange = (x) => {
    let rule = "field";
    if (x?.rule === "static") rule = "static";
    else if (x?.rule === "charGrid") rule = "charGrid";
    return {
      rangeName: toString(x?.rangeName),
      sheetName: toString(x?.sheetName),
      rule,
      fieldKey: toString(x?.fieldKey),
      value: toString(x?.value),
      templateRowIndex: Number.isFinite(Number(x?.templateRowIndex)) ? Number(x.templateRowIndex) : null,
      templateColIndex: Number.isFinite(Number(x?.templateColIndex)) ? Number(x.templateColIndex) : null,
    };
  };
  const normalizeDetailTable = (x) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) {
      return null;
    }
    const columnMappings = toArray(x.columnMappings)
      .map((item, index) => ({
        col: Number.isFinite(Number(item?.col)) ? Number(item.col) : index,
        label: toString(item?.label),
        fieldKey: toString(item?.fieldKey),
      }))
      .filter((item) => item.fieldKey);
    const legacyColumns = toArray(x.columns)
      .map((col) => (typeof col === "string" ? col.trim() : toString(col?.fieldKey)))
      .filter(Boolean);
    const columns = columnMappings.length
      ? columnMappings.map((item) => item.fieldKey)
      : legacyColumns;
    if (!columns.length) {
      return null;
    }
    const startRow = Number.isFinite(Number(x.startRow)) ? Number(x.startRow) : 8;
    const templateRow = Number.isFinite(Number(x.templateRow)) ? Number(x.templateRow) : startRow;
    const totalTemplateRow = Number.isFinite(Number(x.totalTemplateRow))
      ? Number(x.totalTemplateRow)
      : startRow + 1;
    return {
      sheetName: toString(x.sheetName),
      headerRow: Number.isFinite(Number(x.headerRow)) ? Number(x.headerRow) : null,
      startRow,
      startCol: Number.isFinite(Number(x.startCol)) ? Number(x.startCol) : 0,
      templateRow,
      totalTemplateRow,
      columns,
      columnMappings: columnMappings.length ? columnMappings : undefined,
      rowHeightPt:
        Number.isFinite(Number(x.rowHeightPt)) && Number(x.rowHeightPt) > 0
          ? Number(x.rowHeightPt)
          : CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt,
      amountFieldKey: toString(x.amountFieldKey) || "thanhTien",
      labelFieldKey: toString(x.labelFieldKey) || "tenHang",
      totalLabel: toString(x.totalLabel) || CHUNG_TU_DEFAULT_SHEET_PRINT.totalLabel,
    };
  };
  const normalizeSheetsPrint = (x) => {
    const defaults = createEmptyFillRulesV2(safeKind).print.sheets;
    const src = x && typeof x === "object" && !Array.isArray(x) ? x : {};
    const numberOrDefault = (value, fallback, min, max) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    return {
      rowHeightPt: numberOrDefault(
        src.rowHeightPt,
        defaults.rowHeightPt ?? CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt,
        8,
        48,
      ),
    };
  };

  const isV2 = Number(raw.version) >= 2 || raw.docs || raw.sheets;
  if (!isV2) {
    return {
      version: 2,
      docs: {
        placeholders: toArray(raw.placeholders).map(normalizePlaceholder),
        regions: toArray(raw.regions).map(normalizeRegion),
      },
      sheets: { namedRanges: [], detailTable: null },
      print: { sheets: normalizeSheetsPrint(raw.print?.sheets) },
      meta: { templateKind: safeKind },
    };
  }

  return {
    version: 2,
    docs: {
      placeholders: toArray(raw.docs?.placeholders).map(normalizePlaceholder),
      regions: toArray(raw.docs?.regions).map(normalizeRegion),
    },
    sheets: {
      namedRanges: toArray(raw.sheets?.namedRanges).map(normalizeNamedRange),
      detailTable: normalizeDetailTable(raw.sheets?.detailTable),
    },
    print: {
      sheets: normalizeSheetsPrint(raw.print?.sheets),
    },
    meta: {
      templateKind: raw.meta?.templateKind === "spreadsheet" || safeKind === "spreadsheet" ? "spreadsheet" : "document",
    },
  };
}

async function getUserChungTuTemplateDriveContext(userId) {
  const ctx = await getUserChungTuDriveContext(userId);
  const drive = createDriveClient(ctx.oauth2Client);
  const folderMeta = await drive.files.get({
    fileId: ctx.templateRootFolderId,
    fields: "id, name, webViewLink",
    supportsAllDrives: false,
  });
  return {
    oauth2Client: ctx.oauth2Client,
    templateFolderId: ctx.templateRootFolderId,
    templateFolderWebViewLink: folderMeta.data.webViewLink ?? null,
    templateFolderName: folderMeta.data.name ?? null,
    midnightFolderId: ctx.midnightFolderId,
    generatedRootFolderId: ctx.generatedRootFolderId,
  };
}

async function assertGoogleDocInTemplateFolder({
  oauth2Client,
  templateFolderId,
  driveFileId,
}) {
  const drive = createDriveClient(oauth2Client);
  let data;
  try {
    const res = await drive.files.get({
      fileId: driveFileId,
      fields: "id, name, parents, mimeType, trashed, webViewLink, driveId, modifiedTime",
      supportsAllDrives: false,
    });
    data = res.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new AppError({
        message: "Không tìm thấy file Google Drive.",
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    throw error;
  }
  if (data.trashed || data.driveId) {
    throw new AppError({
      message: "File không hợp lệ hoặc không nằm trong My Drive được phép.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (!data.parents?.includes(templateFolderId)) {
    throw new AppError({
      message: "File không nằm trong thư mục template chứng từ quyết toán.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (!TEMPLATE_LIST_MIMES.includes(data.mimeType)) {
    throw new AppError({
      message: "Template phải là Google Docs hoặc Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return data;
}

async function getChungTuQuyetToanHealth({ user, unitScope, effectiveUnitIds }) {
  return {
    status: "ok",
    module: "chungtuquyettoan",
    serverTime: new Date().toISOString(),
    actor: {
      userId: user?.id ?? null,
      type: user?.type?.name ?? null,
    },
    scope: {
      selectedUnitId: unitScope?.selectedUnitId ?? null,
      all: unitScope?.all === true,
      effectiveUnitIds: Array.isArray(effectiveUnitIds) ? effectiveUnitIds : [],
    },
  };
}

async function listDriveTemplates({ userId }) {
  const { oauth2Client, templateFolderId, templateFolderWebViewLink, templateFolderName } =
    await getUserChungTuTemplateDriveContext(userId);

  const drive = createDriveClient(oauth2Client);
  const items = [];
  let pageToken;
  do {
    const list = await drive.files.list({
      q: [
        `'${templateFolderId}' in parents`,
        `(mimeType='${GOOGLE_DOC_MIME}' or mimeType='${GOOGLE_SHEET_MIME}')`,
        "trashed=false",
      ].join(" and "),
      fields: "nextPageToken, files(id, name, modifiedTime, webViewLink, mimeType)",
      spaces: "drive",
      corpora: "user",
      pageSize: 100,
      pageToken,
      supportsAllDrives: false,
      includeItemsFromAllDrives: false,
    });
    for (const f of list.data.files ?? []) {
      if (f.id && f.name) {
        const templateKind = templateKindFromMime(f.mimeType ?? GOOGLE_DOC_MIME);
        items.push({
          driveFileId: f.id,
          driveFileName: f.name,
          modifiedTime: f.modifiedTime ?? null,
          webViewLink: f.webViewLink ?? null,
          mimeType: f.mimeType ?? GOOGLE_DOC_MIME,
          workspaceKind: templateKind,
          templateKind,
        });
      }
    }
    pageToken = list.data.nextPageToken;
  } while (pageToken);

  const ids = items.map((i) => i.driveFileId);
  const configs =
    ids.length > 0
      ? await prisma.chungTuQuyetToanTemplateConfig.findMany({
          where: { userId, driveFileId: { in: ids } },
          select: { driveFileId: true, displayName: true },
        })
      : [];
  const configByFileId = new Map(configs.map((c) => [c.driveFileId, c]));

  return {
    templateFolderId,
    templateFolderName,
    templateFolderWebViewLink,
    items: items.map((row) => {
      const cfg = configByFileId.get(row.driveFileId);
      const displayName = cfg?.displayName ?? null;
      const rawLabel = displayName?.trim() ? displayName.trim() : row.driveFileName;
      return {
        ...row,
        displayName,
        label: rawLabel,
        hasConfig: configByFileId.has(row.driveFileId),
      };
    }),
  };
}

async function getTemplateFillRules({ userId, driveFileId }) {
  const { oauth2Client, templateFolderId } = await getUserChungTuTemplateDriveContext(userId);
  const meta = await assertGoogleDocInTemplateFolder({
    oauth2Client,
    templateFolderId,
    driveFileId,
  });

  const row = await prisma.chungTuQuyetToanTemplateConfig.findUnique({
    where: {
      userId_driveFileId: {
        userId,
        driveFileId,
      },
    },
  });

  return {
    driveFileId,
    driveFileName: meta.name ?? null,
    displayName: row?.displayName ?? null,
    webViewLink: meta.webViewLink ?? null,
    modifiedTime: meta.modifiedTime ?? null,
    templateKind: templateKindFromMime(meta.mimeType),
    fillRules: normalizeFillRulesV2(row?.fillRulesJson ?? null, templateKindFromMime(meta.mimeType)),
  };
}

async function putTemplateFillRules({ userId, driveFileId, fillRules, displayName }) {
  const existing = await prisma.chungTuQuyetToanTemplateConfig.findUnique({
    where: {
      userId_driveFileId: {
        userId,
        driveFileId,
      },
    },
  });

  let nextDisplayName = existing?.displayName ?? null;
  if (displayName !== undefined) {
    if (displayName === null || displayName === "") {
      nextDisplayName = null;
    } else {
      nextDisplayName = String(displayName).trim().slice(0, 200) || null;
    }
  }

  const { oauth2Client, templateFolderId } = await getUserChungTuTemplateDriveContext(userId);
  const meta = await assertGoogleDocInTemplateFolder({
    oauth2Client,
    templateFolderId,
    driveFileId,
  });
  const templateKind = templateKindFromMime(meta.mimeType);

  let nextFillRules = normalizeFillRulesV2(existing?.fillRulesJson ?? null, templateKind);
  if (fillRules !== undefined) {
    assertJsonObject(fillRules);
    nextFillRules = normalizeFillRulesV2(fillRules, templateKind);
  }

  await prisma.chungTuQuyetToanTemplateConfig.upsert({
    where: {
      userId_driveFileId: {
        userId,
        driveFileId,
      },
    },
    create: {
      userId,
      driveFileId,
      fillRulesJson: nextFillRules,
      displayName: nextDisplayName,
    },
    update: {
      fillRulesJson: nextFillRules,
      displayName: nextDisplayName,
    },
  });

  const saved = await prisma.chungTuQuyetToanTemplateConfig.findUnique({
    where: {
      userId_driveFileId: {
        userId,
        driveFileId,
      },
    },
  });

  return {
    driveFileId,
    driveFileName: meta.name ?? null,
    displayName: saved?.displayName ?? null,
    webViewLink: meta.webViewLink ?? null,
    modifiedTime: meta.modifiedTime ?? null,
    templateKind,
    fillRules: normalizeFillRulesV2(saved?.fillRulesJson ?? null, templateKind),
  };
}

/** Đọc named ranges từ Google Sheets template (API spreadsheets.get). */
async function listSpreadsheetNamedRanges({ userId, driveFileId }) {
  const { oauth2Client } = await getUserChungTuTemplateDriveContext(userId);
  const drive = createDriveClient(oauth2Client);
  let meta;
  try {
    const res = await drive.files.get({
      fileId: driveFileId,
      fields: "id, name, parents, mimeType, trashed, webViewLink, driveId, modifiedTime",
      supportsAllDrives: false,
    });
    meta = res.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new AppError({
        message: "Không tìm thấy file Google Drive.",
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    throw error;
  }
  if (meta.trashed || meta.driveId) {
    throw new AppError({
      message: "File không hợp lệ hoặc không nằm trong My Drive được phép.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  if (meta.mimeType !== GOOGLE_SHEET_MIME) {
    throw new AppError({
      message: "Template phải là Google Sheets mới có Named range.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const sheetsApi = createSheetsClient(oauth2Client);
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
          "Không đọc được Google Sheets (thiếu quyền spreadsheets.readonly — hãy gỡ quyền ứng dụng trong Google Account rồi liên kết lại Drive từ trang chủ).",
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
    if (sid != null && sid !== undefined) {
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
      sheetTitle: sheetId != null && !Number.isNaN(sheetId) ? (sheetIdToTitle.get(sheetId) ?? "") : "",
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
    spreadsheetTitle: res.data.properties?.title ?? meta.name ?? null,
    items,
  };
}

async function importFileToGoogleWorkspace({
  userId,
  buffer,
  originalFilename,
  targetFolder = "template",
  categoryKey,
  documentTitle,
}) {
  if (!buffer?.length) {
    throw new AppError({
      message: "File rỗng.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (buffer.length > MAX_IMPORT_BYTES) {
    throw new AppError({
      message: `File vượt quá ${Math.floor(MAX_IMPORT_BYTES / (1024 * 1024))}MB.`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const ext = path.extname(originalFilename || "").toLowerCase();
  if (!assertAllowedExtension(ext)) {
    throw new AppError({
      message: "Chỉ chấp nhận .pdf, .doc, .docx, .xls, .xlsx.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (ext === ".pdf" && !isPdfBuffer(buffer)) {
    throw new AppError({
      message: "Nội dung không giống file PDF.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  let oauth2Client;
  let parentId;
  if (targetFolder === "midnight") {
    const ctx = await getUserChungTuDriveContext(userId);
    oauth2Client = ctx.oauth2Client;
    parentId = ctx.midnightFolderId;
  } else if (targetFolder === "category" && categoryKey) {
    const resolved = await resolveCategoryFolderId({ userId, categoryKey });
    oauth2Client = resolved.oauth2Client;
    parentId = resolved.categoryFolderId;
  } else {
    const ctx = await getUserChungTuTemplateDriveContext(userId);
    oauth2Client = ctx.oauth2Client;
    parentId = ctx.templateFolderId;
  }

  const cfg = EXT_TO_CONVERSION[ext];
  const title = normalizeDocumentTitle(
    typeof documentTitle === "string" && documentTitle.trim()
      ? documentTitle
      : titleFromOriginalFilename(originalFilename),
  );
  if (!title) {
    throw new AppError({
      message: "Thiếu tên tài liệu.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const conversionMeta = {
    name: title,
    parents: [parentId],
    mimeType: cfg.targetMime,
  };

  let raw;
  let converted = true;

  try {
    raw = await driveResumableCreateUpload(oauth2Client, {
      metadata: conversionMeta,
      sourceMime: cfg.sourceMime,
      buffer,
    });
  } catch (firstError) {
    if (ext === ".pdf") {
      logger.warn({ err: firstError?.message }, "Chuyển PDF sang Google Doc thất bại, lưu dạng PDF");
      converted = false;
      const pdfName = /\.pdf$/i.test(title) ? title : `${title}.pdf`;
      raw = await driveResumableCreateUpload(oauth2Client, {
        metadata: {
          name: pdfName,
          parents: [parentId],
        },
        sourceMime: "application/pdf",
        buffer,
      });
    } else {
      throw firstError;
    }
  }

  const drive = createDriveClient(oauth2Client);
  const full = await drive.files.get({
    fileId: raw.id,
    fields: "id, name, mimeType, webViewLink, parents",
    supportsAllDrives: false,
  });

  const mime = full.data.mimeType ?? "";
  let workspaceKind = "other";
  if (mime === GOOGLE_DOC_MIME || mime === GOOGLE_SHEET_MIME) {
    workspaceKind = templateKindFromMime(mime);
  } else if (mime === "application/pdf") {
    workspaceKind = "pdf";
  }

  const driveFileId = full.data.id;
  if (driveFileId) {
    await prisma.chungTuQuyetToanTemplateConfig.upsert({
      where: {
        userId_driveFileId: {
          userId,
          driveFileId,
        },
      },
      create: {
        userId,
        driveFileId,
        fillRulesJson: createEmptyFillRulesV2(workspaceKind),
        displayName: title,
      },
      update: {
        displayName: title,
      },
    });
  }

  return {
    driveFileId,
    name: full.data.name ?? title,
    mimeType: mime,
    webViewLink: full.data.webViewLink ?? null,
    workspaceKind,
    templateKind: workspaceKind,
    converted,
    parentFolderId: parentId,
    targetFolder,
    displayName: title,
  };
}

/**
 * Tải Word/Excel (và tùy chọn PDF) lên thư mục mẫu trên Drive user, chuyển sang Docs/Sheets khi khớp.
 */
async function importOfficeBinaryToUserTemplateFolder({
  userId,
  categoryKey,
  buffer,
  originalFilename,
  documentTitle,
  allowPdf = false,
}) {
  if (!buffer?.length) {
    throw new AppError({
      message: "File rỗng.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (buffer.length > MAX_IMPORT_BYTES) {
    throw new AppError({
      message: `File vượt quá ${Math.floor(MAX_IMPORT_BYTES / (1024 * 1024))}MB.`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const ext = path.extname(originalFilename || "").toLowerCase();
  if (!assertAllowedExtension(ext)) {
    throw new AppError({
      message: "Chỉ chấp nhận .pdf, .doc, .docx, .xls, .xlsx.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (!allowPdf && ext === ".pdf") {
    throw new AppError({
      message: "Chỉ chấp nhận Word (.doc, .docx) hoặc Excel (.xls, .xlsx).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (ext === ".pdf" && !isPdfBuffer(buffer)) {
    throw new AppError({
      message: "Nội dung không giống file PDF.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  let oauth2Client;
  let parentId;
  if (categoryKey) {
    const resolved = await resolveCategoryFolderId({ userId, categoryKey });
    oauth2Client = resolved.oauth2Client;
    parentId = resolved.categoryFolderId;
  } else {
    const ctx = await getUserChungTuTemplateDriveContext(userId);
    oauth2Client = ctx.oauth2Client;
    parentId = ctx.templateFolderId;
  }
  const cfg = EXT_TO_CONVERSION[ext];
  const title = normalizeDocumentTitle(
    typeof documentTitle === "string" && documentTitle.trim()
      ? documentTitle
      : titleFromOriginalFilename(originalFilename),
  );
  if (!title) {
    throw new AppError({
      message: "Thiếu tên tài liệu.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const conversionMeta = {
    name: title,
    parents: [parentId],
    mimeType: cfg.targetMime,
  };

  let raw;
  let converted = true;

  try {
    raw = await driveResumableCreateUpload(oauth2Client, {
      metadata: conversionMeta,
      sourceMime: cfg.sourceMime,
      buffer,
    });
  } catch (firstError) {
    if (allowPdf && ext === ".pdf") {
      logger.warn({ err: firstError?.message }, "Chuyển PDF sang Google Doc thất bại, lưu dạng PDF");
      converted = false;
      const pdfName = /\.pdf$/i.test(title) ? title : `${title}.pdf`;
      raw = await driveResumableCreateUpload(oauth2Client, {
        metadata: {
          name: pdfName,
          parents: [parentId],
        },
        sourceMime: "application/pdf",
        buffer,
      });
    } else {
      throw firstError;
    }
  }

  const drive = createDriveClient(oauth2Client);
  const full = await drive.files.get({
    fileId: raw.id,
    fields: "id, name, mimeType, webViewLink, parents",
    supportsAllDrives: false,
  });

  const mime = full.data.mimeType ?? "";
  let workspaceKind = "other";
  if (mime === GOOGLE_DOC_MIME || mime === GOOGLE_SHEET_MIME) {
    workspaceKind = templateKindFromMime(mime);
  } else if (mime === "application/pdf") {
    workspaceKind = "pdf";
  }

  return {
    driveFileId: full.data.id,
    name: full.data.name ?? title,
    mimeType: mime,
    webViewLink: full.data.webViewLink ?? null,
    workspaceKind,
    templateKind: workspaceKind,
    converted,
    parentFolderId: parentId,
  };
}

export {
  assertJsonObject,
  getChungTuQuyetToanHealth,
  getTemplateFillRules,
  importFileToGoogleWorkspace,
  importOfficeBinaryToUserTemplateFolder,
  listDriveTemplates,
  listSpreadsheetNamedRanges,
  normalizeFillRulesV2,
  putTemplateFillRules,
};
