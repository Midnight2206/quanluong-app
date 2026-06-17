import path from "node:path";
import { google } from "googleapis";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { logger } from "../../shared/utils/logger.js";
import {
  getOAuthClient,
  getSystemChungTuDriveOAuthClient,
  resolveSystemChungTuTemplateFolder,
} from "../auth/google-drive-link.service.js";

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
  const tokenResponse = await oauth2Client.getAccessToken();
  const accessToken = tokenResponse?.token;
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
      pdf: {
        pageSize: "A4",
        orientation: "portrait",
        marginTopCm: 1.5,
        marginRightCm: 1.5,
        marginBottomCm: 1.5,
        marginLeftCm: 1.5,
        fontSizePt: 11,
        table: {
          headerLabels: [],
          amountFieldKey: "thanhTien",
          carryInLabel: "Mang sang",
          carryOutLabel: "Cộng sang trang",
          totalLabel: "Tổng thành tiền",
        },
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
    };
  };
  const normalizeDetailTable = (x) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) {
      return null;
    }
    const columns = toArray(x.columns)
      .map((col) => (typeof col === "string" ? col.trim() : toString(col?.fieldKey)))
      .filter(Boolean);
    if (!columns.length) {
      return null;
    }
    return {
      sheetName: toString(x.sheetName),
      startRow: Number.isFinite(Number(x.startRow)) ? Number(x.startRow) : 8,
      startCol: Number.isFinite(Number(x.startCol)) ? Number(x.startCol) : 0,
      columns,
      repeatHeaderEveryRows:
        Number.isFinite(Number(x.repeatHeaderEveryRows)) && Number(x.repeatHeaderEveryRows) > 0
          ? Number(x.repeatHeaderEveryRows)
          : 0,
      repeatHeaderLabels: toArray(x.repeatHeaderLabels)
        .map((label) => toString(label))
        .filter(Boolean),
      pageRowsFirst:
        Number.isFinite(Number(x.pageRowsFirst)) && Number(x.pageRowsFirst) > 0
          ? Number(x.pageRowsFirst)
          : 0,
      pageRowsNext:
        Number.isFinite(Number(x.pageRowsNext)) && Number(x.pageRowsNext) > 0
          ? Number(x.pageRowsNext)
          : 0,
      amountFieldKey: toString(x.amountFieldKey) || "thanhTien",
      labelFieldKey: toString(x.labelFieldKey) || "tenHang",
      carryInLabel: toString(x.carryInLabel) || "Mang sang",
      carryOutLabel: toString(x.carryOutLabel) || "Cộng sang trang",
    };
  };
  const normalizePdfPrint = (x) => {
    const defaults = createEmptyFillRulesV2(safeKind).print.pdf;
    const src = x && typeof x === "object" && !Array.isArray(x) ? x : {};
    const table = src.table && typeof src.table === "object" && !Array.isArray(src.table) ? src.table : {};
    const numberOrDefault = (value, fallback, min, max) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    return {
      pageSize: src.pageSize === "A4" ? "A4" : defaults.pageSize,
      orientation: src.orientation === "landscape" ? "landscape" : "portrait",
      marginTopCm: numberOrDefault(src.marginTopCm, defaults.marginTopCm, 0.5, 5),
      marginRightCm: numberOrDefault(src.marginRightCm, defaults.marginRightCm, 0.5, 5),
      marginBottomCm: numberOrDefault(src.marginBottomCm, defaults.marginBottomCm, 0.5, 5),
      marginLeftCm: numberOrDefault(src.marginLeftCm, defaults.marginLeftCm, 0.5, 5),
      fontSizePt: numberOrDefault(src.fontSizePt, defaults.fontSizePt, 8, 16),
      table: {
        headerLabels: toArray(table.headerLabels)
          .map((label) => toString(label))
          .filter(Boolean),
        amountFieldKey: toString(table.amountFieldKey) || defaults.table.amountFieldKey,
        carryInLabel: toString(table.carryInLabel) || defaults.table.carryInLabel,
        carryOutLabel: toString(table.carryOutLabel) || defaults.table.carryOutLabel,
        totalLabel: toString(table.totalLabel) || defaults.table.totalLabel,
      },
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
      print: { pdf: normalizePdfPrint(raw.print?.pdf) },
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
      pdf: normalizePdfPrint(raw.print?.pdf),
    },
    meta: {
      templateKind: raw.meta?.templateKind === "spreadsheet" || safeKind === "spreadsheet" ? "spreadsheet" : "document",
    },
  };
}

async function getUserMidnightDriveContext(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true, googleDriveFolderId: true },
  });
  if (!user?.googleRefreshToken || !user?.googleDriveFolderId) {
    throw new AppError({
      message:
        "Chưa liên kết Google Drive hoặc chưa có thư mục làm việc. Hãy liên kết từ trang chủ rồi thử lại.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const client = getOAuthClient();
  if (!client) {
    throw new AppError({
      message: "Google OAuth chưa được cấu hình.",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  client.setCredentials({ refresh_token: user.googleRefreshToken });
  return {
    oauth2Client: client,
    midnightFolderId: user.googleDriveFolderId,
  };
}

/** Drive tài khoản hệ thống — thư mục mẫu chứng từ (CHUNG_TU_SYSTEM_*). Không dùng Drive của user thường. */
async function getSystemChungTuDriveContext() {
  const oauth2Client = getSystemChungTuDriveOAuthClient();
  const folder = await resolveSystemChungTuTemplateFolder(oauth2Client);
  return {
    oauth2Client,
    templateFolderId: folder.templateFolderId,
    templateFolderWebViewLink: folder.templateFolderWebViewLink,
    templateFolderName: folder.templateFolderName,
  };
}

async function assertGoogleDocInTemplateFolder({
  oauth2Client,
  templateFolderId,
  driveFileId,
}) {
  const drive = google.drive({ version: "v3", auth: oauth2Client });
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
    await getSystemChungTuDriveContext();

  const drive = google.drive({ version: "v3", auth: oauth2Client });
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
  const { oauth2Client, templateFolderId } = await getSystemChungTuDriveContext();
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

  const { oauth2Client, templateFolderId } = await getSystemChungTuDriveContext();
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
  const { oauth2Client, templateFolderId } = await getSystemChungTuDriveContext();
  const meta = await assertGoogleDocInTemplateFolder({
    oauth2Client,
    templateFolderId,
    driveFileId,
  });

  if (meta.mimeType !== GOOGLE_SHEET_MIME) {
    throw new AppError({
      message: "Template phải là Google Sheets mới có Named range.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

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
          "Không đọc được Google Sheets (thiếu quyền spreadsheets.readonly trên OAuth tài khoản hệ thống template — kiểm tra GCP và refresh token CHUNG_TU_SYSTEM_DRIVE_REFRESH_TOKEN).",
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
    const ctx = await getUserMidnightDriveContext(userId);
    oauth2Client = ctx.oauth2Client;
    parentId = ctx.midnightFolderId;
  } else {
    const ctx = await getSystemChungTuDriveContext();
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

  const drive = google.drive({ version: "v3", auth: oauth2Client });
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
 * Tải Word/Excel (và tùy chọn PDF) lên thư mục mẫu Google Drive hệ thống, chuyển sang Docs/Sheets khi khớp.
 * Không ghi `ChungTuQuyetToanTemplateConfig` — dùng cho superadmin đăng ký danh mục template.
 */
async function importOfficeBinaryToSystemTemplateFolder({
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

  const { oauth2Client, templateFolderId: parentId } = await getSystemChungTuDriveContext();
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

  const drive = google.drive({ version: "v3", auth: oauth2Client });
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
  importOfficeBinaryToSystemTemplateFolder,
  listDriveTemplates,
  listSpreadsheetNamedRanges,
  normalizeFillRulesV2,
  putTemplateFillRules,
};
