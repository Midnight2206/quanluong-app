import { google } from "googleapis";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  buildFolderPathFromDrive,
  fetchDriveFileMeta,
  isDescendantOfFolder,
} from "./chung-tu-drive-file.util.js";
import { getDriveContext, resolveCategoryFolderId } from "./chung-tu-drive-folders.service.js";
import { createDriveClient } from "../../shared/utils/google-drive-fetch.api.js";
import {
  buildTemplateFullDisplayName,
  resolveCategoryKeyFromFolderPath,
  sortDriveEntriesByName,
} from "./chung-tu-template-tree.util.js";

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const TEMPLATE_MIMES = new Set([GOOGLE_SHEET_MIME, GOOGLE_DOC_MIME]);

async function listChildrenInFolder(drive, folderId) {
  const folders = [];
  const templates = [];
  let pageToken;
  do {
    const list = await drive.files.list({
      q: [`'${folderId}' in parents`, "trashed=false"].join(" and "),
      fields: "nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime)",
      spaces: "drive",
      corpora: "user",
      pageSize: 200,
      pageToken,
      supportsAllDrives: false,
      orderBy: "folder,name",
    });
    for (const file of list.data.files ?? []) {
      if (!file?.id || file.driveId) continue;
      if (file.mimeType === DRIVE_FOLDER_MIME) {
        folders.push({
          id: file.id,
          name: file.name ?? "",
          mimeType: file.mimeType,
        });
        continue;
      }
      if (!TEMPLATE_MIMES.has(String(file.mimeType ?? ""))) continue;
      templates.push({
        driveFileId: file.id,
        driveFileName: file.name ?? "",
        mimeType: file.mimeType ?? null,
        webViewLink: file.webViewLink ?? null,
        modifiedTime: file.modifiedTime ?? null,
        workspaceKind: file.mimeType === GOOGLE_SHEET_MIME ? "spreadsheet" : "document",
      });
    }
    pageToken = list.data.nextPageToken;
  } while (pageToken);
  return {
    folders: sortDriveEntriesByName(folders),
    templates: sortDriveEntriesByName(templates),
  };
}

async function loadCatalogDisplayNameByFileId(driveFileIds) {
  const ids = [...new Set((driveFileIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.chungTuDriveTemplateLink.findMany({
    where: { driveFileId: { in: ids }, isActive: true },
    select: { driveFileId: true, displayName: true, categoryKey: true },
  });
  return new Map(rows.map((row) => [row.driveFileId, row]));
}

function enrichTemplateRow({ template, folderPath, catalogByFileId }) {
  const catalog = catalogByFileId.get(template.driveFileId);
  const templateLeafName =
    String(catalog?.displayName ?? "").trim() || template.driveFileName || "";
  const categoryKey =
    catalog?.categoryKey ?? resolveCategoryKeyFromFolderPath(folderPath) ?? "";
  const fullDocumentName = buildTemplateFullDisplayName(folderPath, templateLeafName);
  return {
    ...template,
    displayName: templateLeafName,
    categoryKey,
    folderPath,
    fullDocumentName,
    catalogRegistered: Boolean(catalog),
  };
}

async function listTemplateFolderBrowse({ userId, folderId, categoryKey } = {}) {
  const { oauth2Client, templateRootFolderId } = await getDriveContext({ userId });
  const drive = createDriveClient(oauth2Client);

  let browseFolderId = String(folderId ?? "").trim();
  if (!browseFolderId && categoryKey) {
    const resolved = await resolveCategoryFolderId({ userId, categoryKey });
    browseFolderId = resolved.categoryFolderId;
  }
  if (!browseFolderId) {
    browseFolderId = templateRootFolderId;
  }

  const folderMeta = await fetchDriveFileMeta(
    drive,
    browseFolderId,
    "id, name, parents, mimeType, webViewLink, trashed, driveId",
  );
  if (folderMeta.trashed || folderMeta.driveId) {
    throw new AppError({
      message: "Thư mục mẫu không hợp lệ.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (folderMeta.mimeType !== DRIVE_FOLDER_MIME) {
    throw new AppError({
      message: "folderId phải là thư mục trên Drive.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const underTemplateRoot = await isDescendantOfFolder(drive, browseFolderId, templateRootFolderId);
  if (!underTemplateRoot && browseFolderId !== templateRootFolderId) {
    throw new AppError({
      message: "Thư mục nằm ngoài pool mẫu chứng từ.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  const folderPath = await buildFolderPathFromDrive(drive, browseFolderId, templateRootFolderId);
  const { folders, templates } = await listChildrenInFolder(drive, browseFolderId);
  const catalogByFileId = await loadCatalogDisplayNameByFileId(templates.map((t) => t.driveFileId));

  return {
    rootFolderId: templateRootFolderId,
    folderId: browseFolderId,
    folderName: folderMeta.name ?? "",
    folderWebViewLink: folderMeta.webViewLink ?? null,
    folderPath,
    folders: folders.map((folder) => ({
      ...folder,
      folderPath: [...folderPath, folder.name],
    })),
    templates: templates.map((template) =>
      enrichTemplateRow({ template, folderPath, catalogByFileId }),
    ),
  };
}

async function resolveTemplateSelectionMeta({ userId, driveFileId }) {
  const fileId = String(driveFileId ?? "").trim();
  if (!fileId) {
    throw new AppError({
      message: "Thiếu driveFileId.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const { oauth2Client, templateRootFolderId } = await getDriveContext({ userId });
  const drive = createDriveClient(oauth2Client);
  const fileMeta = await fetchDriveFileMeta(
    drive,
    fileId,
    "id, name, parents, mimeType, webViewLink, trashed, driveId",
  );
  if (fileMeta.trashed || fileMeta.driveId) {
    throw new AppError({
      message: "File mẫu không hợp lệ.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (!TEMPLATE_MIMES.has(String(fileMeta.mimeType ?? ""))) {
    throw new AppError({
      message: "File phải là Google Sheets hoặc Google Docs.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const parentId = fileMeta.parents?.[0];
  if (!parentId) {
    throw new AppError({
      message: "Không xác định được thư mục chứa mẫu.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const underTemplateRoot = await isDescendantOfFolder(drive, fileId, templateRootFolderId);
  if (!underTemplateRoot) {
    throw new AppError({
      message: "File mẫu nằm ngoài pool chứng từ quyết toán.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
  const folderPath = await buildFolderPathFromDrive(drive, parentId, templateRootFolderId);
  const catalogByFileId = await loadCatalogDisplayNameByFileId([fileId]);
  const template = enrichTemplateRow({
    template: {
      driveFileId: fileMeta.id,
      driveFileName: fileMeta.name ?? "",
      mimeType: fileMeta.mimeType ?? null,
      webViewLink: fileMeta.webViewLink ?? null,
      workspaceKind: fileMeta.mimeType === GOOGLE_SHEET_MIME ? "spreadsheet" : "document",
    },
    folderPath,
    catalogByFileId,
  });
  if (!template.categoryKey) {
    throw new AppError({
      message: "Không xác định được loại chứng từ từ đường dẫn thư mục mẫu.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return template;
}

export { listTemplateFolderBrowse, resolveTemplateSelectionMeta };
