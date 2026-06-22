import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { logger } from "../../shared/utils/logger.js";
import { createDriveClient } from "../../shared/utils/google-drive-fetch.api.js";
import { createUserChungTuDriveOAuthClient } from "../auth/google-drive-link.service.js";
import {
  assertJsonObject,
  importOfficeBinaryToUserTemplateFolder,
  normalizeFillRulesV2,
} from "./chung-tu-quyet-toan.service.js";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const TEMPLATE_MIMES = new Set([GOOGLE_DOC_MIME, GOOGLE_SHEET_MIME]);

export function parseGoogleDriveFileIdFromUrl(input) {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return null;
  }
  if (/^[A-Za-z0-9_-]{10,128}$/.test(raw) && !raw.includes("/")) {
    return raw;
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    const mPath = raw.match(/\/d\/([A-Za-z0-9_-]+)/);
    if (mPath) {
      return mPath[1];
    }
    const mId = raw.match(/[?&]id=([A-Za-z0-9_-]+)/);
    return mId ? mId[1] : null;
  }
  const m = url.pathname.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (m) {
    return m[1];
  }
  const openId = url.searchParams.get("id");
  if (openId && /^[A-Za-z0-9_-]+$/.test(openId)) {
    return openId;
  }
  return null;
}

async function fetchDriveFileMetaUser({ userId, driveFileId }) {
  const oauth2Client = await createUserChungTuDriveOAuthClient(userId);
  const drive = createDriveClient(oauth2Client);
  try {
    const res = await drive.files.get({
      fileId: driveFileId,
      fields: "id,name,mimeType,webViewLink,trashed,driveId",
      supportsAllDrives: false,
    });
    const data = res.data;
    if (data.trashed) {
      throw new AppError({
        message: "File Google Drive đã vào thùng rác.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (data.driveId) {
      throw new AppError({
        message: "Chỉ hỗ trợ file trong My Drive của tài khoản hệ thống (không phải Shared Drive).",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!TEMPLATE_MIMES.has(String(data.mimeType ?? ""))) {
      throw new AppError({
        message: "Template phải là Google Docs hoặc Google Sheets.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    return {
      driveFileId: data.id,
      name: data.name ?? null,
      mimeType: data.mimeType ?? null,
      webViewLink: data.webViewLink ?? null,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const status = error?.response?.status;
    if (status === 404) {
      throw new AppError({
        message:
          "Không đọc được file trên Drive (404). Kiểm tra link và quyền truy cập trên Drive đã liên kết.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    logger.warn(
      { driveFileId, status, err: error?.message },
      "ChungTu template catalog: Drive files.get lỗi",
    );
    throw new AppError({
      message: "Không truy cập được file trên Google Drive.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

function fillRulesTemplateKindFromMime(mimeType) {
  return mimeType === GOOGLE_SHEET_MIME ? "spreadsheet" : "document";
}

function mapNormalizedFillRules(row) {
  const kind = fillRulesTemplateKindFromMime(String(row.mimeType ?? ""));
  return normalizeFillRulesV2(row.fillRulesJson ?? null, kind);
}

function mapPublicRow(row) {
  return {
    id: row.id,
    categoryKey: row.categoryKey,
    displayName: row.displayName,
    driveFileId: row.driveFileId,
    webViewLink: row.webViewLink,
    mimeType: row.mimeType,
    sortOrder: row.sortOrder,
    fillRules: mapNormalizedFillRules(row),
  };
}

function mapManageRow(row) {
  return {
    ...mapPublicRow(row),
    linkUrl: row.linkUrl,
    isActive: row.isActive,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

async function listTemplateCatalogLinks({ categoryKey, activeOnly }) {
  const where = {
    ...(typeof categoryKey === "string" && categoryKey.trim()
      ? { categoryKey: categoryKey.trim() }
      : {}),
    ...(activeOnly ? { isActive: true } : {}),
  };
  return prisma.chungTuDriveTemplateLink.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

async function listTemplateCatalogForApp({ categoryKey }) {
  const rows = await listTemplateCatalogLinks({ categoryKey, activeOnly: true });
  return rows.map(mapPublicRow);
}

async function listTemplateCatalogManage({ categoryKey }) {
  const rows = await listTemplateCatalogLinks({
    categoryKey:
      typeof categoryKey === "string" && categoryKey.trim() ? categoryKey.trim() : undefined,
    activeOnly: false,
  });
  return rows.map(mapManageRow);
}

async function createTemplateCatalogLink({ userId, categoryKey, displayName, linkUrl, sortOrder }) {
  const cid = String(categoryKey ?? "").trim().slice(0, 80);
  const dname = String(displayName ?? "").trim().slice(0, 200);
  const url = String(linkUrl ?? "").trim();
  if (!cid || !dname || !url) {
    throw new AppError({
      message: "Thiếu categoryKey, displayName hoặc linkUrl.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const driveFileId = parseGoogleDriveFileIdFromUrl(url);
  if (!driveFileId) {
    throw new AppError({
      message: "Không trích được ID file từ URL. Dán link Google Docs/Sheets (dạng .../d/FILE_ID/...).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const meta = await fetchDriveFileMetaUser({ userId, driveFileId });
  let nextSort = sortOrder;
  if (nextSort == null || !Number.isFinite(Number(nextSort))) {
    const agg = await prisma.chungTuDriveTemplateLink.aggregate({
      where: { categoryKey: cid },
      _max: { sortOrder: true },
    });
    nextSort = Number(agg._max.sortOrder ?? -1) + 1;
  }
  try {
    const row = await prisma.chungTuDriveTemplateLink.create({
      data: {
        categoryKey: cid,
        displayName: dname,
        driveFileId: meta.driveFileId,
        linkUrl: url.slice(0, 4000),
        mimeType: meta.mimeType,
        webViewLink: meta.webViewLink ? meta.webViewLink.slice(0, 1024) : null,
        sortOrder: Number(nextSort),
      },
    });
    return mapManageRow(row);
  } catch (error) {
    if (error?.code === "P2002") {
      throw new AppError({
        message: "Đã có mẫu với cùng loại (category) và cùng ID file Drive.",
        statusCode: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    throw error;
  }
}

function buildDriveWorkspaceEditLink(driveFileId, mimeType) {
  const id = String(driveFileId ?? "").trim();
  if (!id) {
    return null;
  }
  if (mimeType === GOOGLE_SHEET_MIME) {
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }
  if (mimeType === GOOGLE_DOC_MIME) {
    return `https://docs.google.com/document/d/${id}/edit`;
  }
  return null;
}

async function createTemplateCatalogFromUploadedOfficeFile({
  userId,
  categoryKey,
  displayName,
  sortOrder,
  buffer,
  originalFilename,
}) {
  const cid = String(categoryKey ?? "").trim().slice(0, 80);
  const dname = String(displayName ?? "").trim().slice(0, 200);
  if (!cid || !dname) {
    throw new AppError({
      message: "Thiếu categoryKey hoặc displayName.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const uploaded = await importOfficeBinaryToUserTemplateFolder({
    userId,
    categoryKey: cid,
    buffer,
    originalFilename,
    documentTitle: dname,
    allowPdf: false,
  });

  if (!TEMPLATE_MIMES.has(String(uploaded.mimeType ?? ""))) {
    throw new AppError({
      message: "Chỉ ghi danh mục khi file đã chuyển thành Google Docs hoặc Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const web =
    (uploaded.webViewLink && String(uploaded.webViewLink).trim()) ||
    buildDriveWorkspaceEditLink(uploaded.driveFileId, uploaded.mimeType);
  if (!web) {
    throw new AppError({
      message: "Không tạo được link mở file trên Workspace.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  const linkUrl = web.slice(0, 4000);

  let nextSort = sortOrder;
  if (nextSort == null || !Number.isFinite(Number(nextSort))) {
    const agg = await prisma.chungTuDriveTemplateLink.aggregate({
      where: { categoryKey: cid },
      _max: { sortOrder: true },
    });
    nextSort = Number(agg._max.sortOrder ?? -1) + 1;
  }

  try {
    const row = await prisma.chungTuDriveTemplateLink.create({
      data: {
        categoryKey: cid,
        displayName: dname,
        driveFileId: uploaded.driveFileId,
        linkUrl,
        mimeType: uploaded.mimeType,
        webViewLink: web.slice(0, 1024),
        sortOrder: Number(nextSort),
      },
    });
    return mapManageRow(row);
  } catch (error) {
    if (error?.code === "P2002") {
      throw new AppError({
        message: "Đã có mẫu với cùng loại (category) và cùng ID file Drive.",
        statusCode: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    throw error;
  }
}

async function patchTemplateCatalogLink({ userId, id, displayName, linkUrl, sortOrder, isActive, fillRules }) {
  const existing = await prisma.chungTuDriveTemplateLink.findUnique({
    where: { id: Number(id) },
  });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy bản ghi danh mục template.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  let nextDriveId = existing.driveFileId;
  let nextMime = existing.mimeType;
  let nextWeb = existing.webViewLink;
  let nextLinkStored = existing.linkUrl;

  if (linkUrl !== undefined) {
    const url = String(linkUrl ?? "").trim();
    if (!url) {
      throw new AppError({
        message: "linkUrl không được để trống.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const parsed = parseGoogleDriveFileIdFromUrl(url);
    if (!parsed) {
      throw new AppError({
        message: "Không trích được ID file từ URL.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const meta = await fetchDriveFileMetaUser({ userId, driveFileId: parsed });
    nextDriveId = meta.driveFileId;
    nextMime = meta.mimeType;
    nextWeb = meta.webViewLink ? meta.webViewLink.slice(0, 1024) : null;
    nextLinkStored = url.slice(0, 4000);
  }

  let nextFillRulesJson = undefined;
  if (fillRules !== undefined) {
    assertJsonObject(fillRules);
    const mimeAfter = linkUrl !== undefined ? nextMime : existing.mimeType;
    const tk = fillRulesTemplateKindFromMime(String(mimeAfter ?? ""));
    nextFillRulesJson = normalizeFillRulesV2(fillRules, tk);
  }

  try {
    const row = await prisma.chungTuDriveTemplateLink.update({
      where: { id: Number(id) },
      data: {
        ...(displayName !== undefined
          ? { displayName: String(displayName ?? "").trim().slice(0, 200) }
          : {}),
        ...(linkUrl !== undefined
          ? { linkUrl: nextLinkStored, driveFileId: nextDriveId, mimeType: nextMime, webViewLink: nextWeb }
          : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(nextFillRulesJson !== undefined ? { fillRulesJson: nextFillRulesJson } : {}),
      },
    });

    return mapManageRow(row);
  } catch (error) {
    if (error?.code === "P2002") {
      throw new AppError({
        message: "Đã có mẫu khác cùng loại và cùng ID file Drive.",
        statusCode: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    throw error;
  }
}

async function deleteTemplateCatalogLink({ id }) {
  try {
    await prisma.chungTuDriveTemplateLink.delete({
      where: { id: Number(id) },
    });
  } catch (error) {
    if (error?.code === "P2025") {
      throw new AppError({
        message: "Không tìm thấy bản ghi danh mục template.",
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    throw error;
  }
  return { id: Number(id) };
}

export {
  createTemplateCatalogFromUploadedOfficeFile,
  createTemplateCatalogLink,
  deleteTemplateCatalogLink,
  fetchDriveFileMetaUser,
  listTemplateCatalogForApp,
  listTemplateCatalogManage,
  patchTemplateCatalogLink,
};
