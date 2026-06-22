import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  ensureChildFolder,
  getUserChungTuDriveContext,
} from "../auth/google-drive-link.service.js";
import { createDriveClient } from "../../shared/utils/google-drive-fetch.api.js";
import { isDescendantOfFolder } from "./chung-tu-drive-file.util.js";
import {
  assertKnownCategoryKey,
  CHUNG_TU_GENERATED_ROOT_FOLDER_NAME,
  CHUNG_TU_TEMPLATE_ROOT_FOLDER_NAME,
} from "./chung-tu-category.constants.js";

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

async function getDriveContext({ userId }) {
  const ctx = await getUserChungTuDriveContext(userId);
  const drive = createDriveClient(ctx.oauth2Client);
  const folderMeta = await drive.files.get({
    fileId: ctx.templateRootFolderId,
    fields: "id, name, webViewLink",
    supportsAllDrives: false,
  });
  return {
    oauth2Client: ctx.oauth2Client,
    templateRootFolderId: ctx.templateRootFolderId,
    generatedRootFolderId: ctx.generatedRootFolderId,
    midnightFolderId: ctx.midnightFolderId,
    templateRootFolderName: folderMeta.data.name ?? CHUNG_TU_TEMPLATE_ROOT_FOLDER_NAME,
    templateRootWebViewLink: folderMeta.data.webViewLink ?? null,
  };
}

async function resolveCategoryFolderId({ userId, categoryKey }) {
  const meta = assertKnownCategoryKey(categoryKey);
  const { oauth2Client, templateRootFolderId } = await getDriveContext({ userId });
  const folderId = await ensureChildFolder({
    oauth2Client,
    parentId: templateRootFolderId,
    folderName: meta.folderName,
  });
  const drive = createDriveClient(oauth2Client);
  const folderMeta = await drive.files.get({
    fileId: folderId,
    fields: "id, name, webViewLink",
    supportsAllDrives: false,
  });
  return {
    oauth2Client,
    categoryFolderId: folderId,
    categoryFolderName: folderMeta.data.name ?? meta.folderName,
    categoryFolderWebViewLink: folderMeta.data.webViewLink ?? null,
  };
}

async function resolveGeneratedUnitFolderId({ userId, unitId }) {
  const uid = Number(unitId);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new AppError({
      message: "unitId không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const { oauth2Client, generatedRootFolderId } = await getDriveContext({ userId });
  const unitFolderId = await ensureChildFolder({
    oauth2Client,
    parentId: generatedRootFolderId,
    folderName: `unit-${uid}`,
  });
  return { oauth2Client, unitFolderId };
}

async function listCategoryTemplates({ userId, categoryKey }) {
  const meta = assertKnownCategoryKey(categoryKey);
  const { oauth2Client, categoryFolderId, categoryFolderName, categoryFolderWebViewLink } =
    await resolveCategoryFolderId({ userId, categoryKey });
  const drive = createDriveClient(oauth2Client);
  const items = [];
  let pageToken;
  do {
    const list = await drive.files.list({
      q: [
        `'${categoryFolderId}' in parents`,
        `(mimeType='${GOOGLE_SHEET_MIME}' or mimeType='${GOOGLE_DOC_MIME}')`,
        "trashed=false",
      ].join(" and "),
      fields: "nextPageToken, files(id, name, modifiedTime, webViewLink, mimeType)",
      spaces: "drive",
      corpora: "user",
      pageSize: 100,
      pageToken,
      supportsAllDrives: false,
    });
    for (const f of list.data.files ?? []) {
      if (!f.id || !f.name) continue;
      items.push({
        driveFileId: f.id,
        driveFileName: f.name,
        modifiedTime: f.modifiedTime ?? null,
        webViewLink: f.webViewLink ?? null,
        mimeType: f.mimeType ?? null,
        workspaceKind: f.mimeType === GOOGLE_SHEET_MIME ? "spreadsheet" : "document",
      });
    }
    pageToken = list.data.nextPageToken;
  } while (pageToken);

  return {
    categoryKey: meta.key,
    categoryLabel: meta.label,
    folderId: categoryFolderId,
    folderName: categoryFolderName,
    folderWebViewLink: categoryFolderWebViewLink,
    items,
  };
}

async function assertTemplateInCategoryFolder({ userId, categoryKey, driveFileId }) {
  const { oauth2Client, categoryFolderId } = await resolveCategoryFolderId({ userId, categoryKey });
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
        message: "Không tìm thấy file mẫu trên Google Drive.",
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    throw error;
  }
  if (data.trashed || data.driveId) {
    throw new AppError({
      message: "File mẫu không hợp lệ.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (!data.parents?.includes(categoryFolderId)) {
    const nested = await isDescendantOfFolder(drive, driveFileId, categoryFolderId);
    if (!nested) {
      throw new AppError({
        message: `File mẫu không nằm trong thư mục ${categoryKey}.`,
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
  }
  if (data.mimeType !== GOOGLE_SHEET_MIME && data.mimeType !== GOOGLE_DOC_MIME) {
    throw new AppError({
      message: "Mẫu phải là Google Sheets hoặc Google Docs.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return { oauth2Client, categoryFolderId, meta: data };
}

async function copyTemplateToUnitFolder({ userId, templateDriveFileId, unitId, title }) {
  const { oauth2Client, unitFolderId } = await resolveGeneratedUnitFolderId({ userId, unitId });
  const drive = createDriveClient(oauth2Client);
  const copied = await drive.files.copy({
    fileId: templateDriveFileId,
    requestBody: {
      name: String(title).slice(0, 200),
      parents: [unitFolderId],
    },
    fields: "id, name, mimeType, webViewLink",
    supportsAllDrives: false,
  });
  return {
    outputDriveFileId: copied.data.id,
    outputWebViewLink: copied.data.webViewLink ?? null,
    outputName: copied.data.name ?? title,
    mimeType: copied.data.mimeType ?? null,
  };
}

export {
  assertTemplateInCategoryFolder,
  copyTemplateToUnitFolder,
  getDriveContext,
  listCategoryTemplates,
  resolveCategoryFolderId,
  resolveGeneratedUnitFolderId,
  CHUNG_TU_TEMPLATE_ROOT_FOLDER_NAME,
  CHUNG_TU_GENERATED_ROOT_FOLDER_NAME,
};
