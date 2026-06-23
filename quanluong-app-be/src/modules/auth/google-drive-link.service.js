/**
 * Liên kết Drive của user — scope `drive` (đọc mẫu user đặt trong workspace + tạo chứng từ trên Drive user).
 * Workspace: `midnight-app/chung-tu-quyet-toan-template` và `chung-tu-quyet-toan-generated`.
 * Gmail gửi thư hệ thống dùng Gmail API riêng (MAIL_TRANSPORT=gmail_api + GMAIL_SENDER_*).
 */
import { google } from "googleapis";
import { config } from "../../config/config.js";
import { CHUNG_TU_CATEGORY_LIST, CHUNG_TU_GENERATED_ROOT_FOLDER_NAME } from "../chung-tu-quyet-toan/chung-tu-category.constants.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { logger } from "../../shared/utils/logger.js";
import { createDriveClient } from "../../shared/utils/google-drive-fetch.api.js";
import {
  attachResilientGoogleTransport,
  isTransientGoogleTransportError,
} from "../../shared/utils/google-api-transport.util.js";

const MIDNIGHT_APP_FOLDER_NAME = "midnight-app";
const CHUNG_TU_QUYET_TOAN_TEMPLATE_FOLDER_NAME = "chung-tu-quyet-toan-template";
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
/** Đọc/ghi file trong My Drive user — cần để liệt kê mẫu user tự đặt và copy tạo chứng từ. */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
/** Đọc metadata/lưới (namedRanges) của Google Sheets mà Drive API đã được phép truy cập. */
const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const DRIVE_FOLDER_HEALTH_ATTEMPTS = 3;
const DRIVE_FOLDER_HEALTH_RETRY_DELAY_MS = 300;
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_TOKEN_REFRESH_ATTEMPTS = 3;
const OAUTH_TOKEN_REFRESH_DELAY_MS = 400;

function googleOAuthConfigError(message, { cause, details } = {}) {
  return new AppError({
    message,
    statusCode: 503,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    details:
      details ??
      (cause?.message && typeof cause.message === "string" ? { cause: cause.message } : undefined),
  });
}

async function refreshAccessTokenViaFetch(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  let lastError;
  for (let attempt = 1; attempt <= OAUTH_TOKEN_REFRESH_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(OAUTH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw googleOAuthConfigError(
          "Google OAuth trả về phản hồi không hợp lệ khi làm mới access token.",
          { details: { status: res.status } },
        );
      }

      if (!res.ok || !data.access_token) {
        const errCode = String(data.error ?? "");
        if (errCode === "invalid_grant") {
          throw googleOAuthConfigError(
            "Refresh token Google Drive hết hạn hoặc không khớp GOOGLE_CLIENT_ID/SECRET. Hãy liên kết lại Google Drive từ trang chủ.",
            { details: { error: data.error, error_description: data.error_description } },
          );
        }
        throw googleOAuthConfigError(
          `Google OAuth từ chối làm mới token (${errCode || res.status}).`,
          { details: data },
        );
      }

      return {
        access_token: data.access_token,
        expiry_date: data.expires_in
          ? Date.now() + Number(data.expires_in) * 1000
          : undefined,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof AppError) {
        throw error;
      }
      if (attempt < OAUTH_TOKEN_REFRESH_ATTEMPTS && isTransientGoogleTransportError(error)) {
        await sleep(OAUTH_TOKEN_REFRESH_DELAY_MS * attempt);
        continue;
      }
      throw googleOAuthConfigError(
        "Không kết nối được Google OAuth (lỗi mạng). Kiểm tra mạng Docker hoặc thử lại sau.",
        { cause: error },
      );
    }
  }

  throw googleOAuthConfigError("Không làm mới được access token Google.", { cause: lastError });
}

async function prepareDriveOAuthClient(oauth2Client) {
  const { clientId, clientSecret } = config.google;
  const refreshToken = String(oauth2Client.credentials?.refresh_token ?? "").trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw googleOAuthConfigError("Thiếu cấu hình Google OAuth hoặc refresh token.");
  }
  const tokens = await refreshAccessTokenViaFetch(clientId, clientSecret, refreshToken);
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    ...tokens,
  });
  attachResilientGoogleTransport(oauth2Client);
  return oauth2Client;
}

function getOAuthClient() {
  const { clientId, clientSecret, redirectUri } = config.google;
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function buildGoogleAuthUrl(state) {
  const client = getOAuthClient();
  if (!client) {
    throw new AppError({
      message: "Google OAuth chưa được cấu hình (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI).",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      DRIVE_SCOPE,
      SHEETS_READONLY_SCOPE,
    ],
    state,
  });
}

async function ensureMidnightAppFolder(oauth2Client) {
  const drive = createDriveClient(oauth2Client);
  const escapedName = MIDNIGHT_APP_FOLDER_NAME.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  const list = await drive.files.list({
    q: [
      `name='${escapedName}'`,
      `mimeType='${DRIVE_FOLDER_MIME_TYPE}'`,
      "trashed=false",
      "'root' in parents",
    ].join(" and "),
    fields: "files(id, name, parents, driveId, webViewLink)",
    spaces: "drive",
    corpora: "user",
    pageSize: 10,
    supportsAllDrives: false,
    includeItemsFromAllDrives: false,
  });

  const existing = list.data.files?.find((file) => !file.driveId);
  if (existing?.id) {
    return existing.id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: MIDNIGHT_APP_FOLDER_NAME,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
    },
    fields: "id, name, parents, driveId, webViewLink",
    supportsAllDrives: false,
  });

  if (!created.data.id || created.data.driveId) {
    logger.error(
      {
        folderId: created.data.id,
        driveId: created.data.driveId,
        parents: created.data.parents,
      },
      "Liên kết Google: folder tạo ra không nằm trong My Drive",
    );
    throw new AppError({
      message: "Không tạo được thư mục trên Google Drive.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  return created.data.id;
}

async function ensureUserChungTuWorkspaceFolders(oauth2Client, midnightFolderId) {
  const templateRootFolderId = await ensureChildFolder({
    oauth2Client,
    parentId: midnightFolderId,
    folderName: CHUNG_TU_QUYET_TOAN_TEMPLATE_FOLDER_NAME,
  });
  const generatedRootFolderId = await ensureChildFolder({
    oauth2Client,
    parentId: midnightFolderId,
    folderName: CHUNG_TU_GENERATED_ROOT_FOLDER_NAME,
  });
  for (const category of CHUNG_TU_CATEGORY_LIST) {
    await ensureChildFolder({
      oauth2Client,
      parentId: templateRootFolderId,
      folderName: category.folderName,
    });
  }
  return { templateRootFolderId, generatedRootFolderId };
}

async function getUserChungTuDriveContext(userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new AppError({
      message: "userId không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const user = await prisma.user.findUnique({
    where: { id: uid },
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
  const oauth2Client = await prepareDriveOAuthClient(client);
  const folders = await ensureUserChungTuWorkspaceFolders(oauth2Client, user.googleDriveFolderId);
  return {
    oauth2Client,
    midnightFolderId: user.googleDriveFolderId,
    ...folders,
  };
}

async function createUserChungTuDriveOAuthClient(userId) {
  const { oauth2Client } = await getUserChungTuDriveContext(userId);
  return oauth2Client;
}

async function ensureChildFolder({ oauth2Client, parentId, folderName }) {
  const drive = createDriveClient(oauth2Client);
  const escapedName = folderName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  const list = await drive.files.list({
    q: [
      `name='${escapedName}'`,
      `mimeType='${DRIVE_FOLDER_MIME_TYPE}'`,
      "trashed=false",
      `'${parentId}' in parents`,
    ].join(" and "),
    fields: "files(id, name, parents, driveId, webViewLink)",
    spaces: "drive",
    corpora: "user",
    pageSize: 10,
    supportsAllDrives: false,
    includeItemsFromAllDrives: false,
  });

  const existing = list.data.files?.find((file) => !file.driveId);
  if (existing?.id) {
    return existing.id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      parents: [parentId],
    },
    fields: "id, name, parents, driveId, webViewLink",
    supportsAllDrives: false,
  });

  if (!created.data.id || created.data.driveId) {
    throw new AppError({
      message: `Không tạo được thư mục con ${folderName} trên Google Drive.`,
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  return created.data.id;
}

function assertGoogleDriveLinkScopesGranted(tokens) {
  const grantedScopes = String(tokens.scope || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!grantedScopes.includes(DRIVE_SCOPE)) {
    logger.warn({ grantedScopes }, "Liên kết Google: OAuth token thiếu scope drive");
    throw new AppError({
      message: "Google không cấp quyền truy cập Google Drive. Hãy chấp nhận đủ quyền rồi liên kết lại.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (!grantedScopes.includes(SHEETS_READONLY_SCOPE)) {
    logger.warn({ grantedScopes }, "Liên kết Google: OAuth token thiếu scope spreadsheets.readonly");
    throw new AppError({
      message:
        "Google chưa cấp quyền đọc Google Sheets. Hãy gỡ quyền ứng dụng trong Google Account → Security → Third-party apps, rồi liên kết lại từ trang chủ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function isDriveNotFoundError(error) {
  return (
    error?.response?.status === 404 ||
    error?.response?.data?.error?.errors?.some((item) => item?.reason === "notFound")
  );
}

function sleep(ms) {
  if (!ms) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function verifyDriveFolderOrClearLink({
  folderId,
  getFolder,
  clearLink,
  attempts = DRIVE_FOLDER_HEALTH_ATTEMPTS,
  retryDelayMs = DRIVE_FOLDER_HEALTH_RETRY_DELAY_MS,
}) {
  let lastNotFound = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const folder = await getFolder(folderId);
      if (folder?.mimeType !== DRIVE_FOLDER_MIME_TYPE || folder?.trashed || folder?.driveId) {
        await clearLink();
        return { status: "cleared" };
      }
      return { status: "linked", folderId: folder.id || folderId };
    } catch (error) {
      if (!isDriveNotFoundError(error)) {
        throw error;
      }
      lastNotFound = error;
      if (attempt < attempts) {
        await sleep(retryDelayMs);
      }
    }
  }

  await clearLink(lastNotFound);
  return { status: "cleared" };
}

async function exchangeCodeAndLinkDrive({ code, userId }) {
  const client = getOAuthClient();
  if (!client) {
    throw new AppError({
      message: "Google OAuth chưa được cấu hình.",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new AppError({
      message: "Google không trả về access token.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  assertGoogleDriveLinkScopesGranted(tokens);

  client.setCredentials(tokens);
  attachResilientGoogleTransport(client);

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true },
  });

  const nextRefresh = tokens.refresh_token || existingUser?.googleRefreshToken;
  if (!nextRefresh) {
    throw new AppError({
      message:
        "Google không cấp refresh token. Hãy vào Tài khoản Google → Bảo mật → Quyền truy cập của bên thứ ba, gỡ ứng dụng này rồi liên kết lại.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!tokens.refresh_token && !existingUser?.googleRefreshToken) {
    logger.warn({ userId }, "Liên kết Google: thiếu refresh_token mới và không có token cũ");
  }

  let folderId;
  try {
    folderId = await ensureMidnightAppFolder(client);
    await ensureUserChungTuWorkspaceFolders(client, folderId);
  } catch (error) {
    logger.error(
      {
        userId,
        status: error.response?.status,
        code: error.response?.data?.error?.code || error.code,
        reason: error.response?.data?.error?.errors?.[0]?.reason,
        message: error.response?.data?.error?.message || error.message,
      },
      "Liên kết Google: không tạo hoặc tìm được folder My Drive",
    );
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError({
      message: "Không tạo được thư mục trên Google Drive.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleRefreshToken: nextRefresh,
      googleDriveFolderId: folderId,
    },
  });

  return { folderId };
}

async function unlinkGoogleDriveForUser(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleRefreshToken: null,
      googleDriveFolderId: null,
    },
  });
}

async function verifyGoogleDriveLinkForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleRefreshToken: true,
      googleDriveFolderId: true,
    },
  });

  if (!user?.googleRefreshToken || !user?.googleDriveFolderId) {
    return { status: "not_linked" };
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
  attachResilientGoogleTransport(client);
  const drive = createDriveClient(client);

  try {
    const status = await verifyDriveFolderOrClearLink({
      folderId: user.googleDriveFolderId,
      getFolder: async (folderId) => {
        const res = await drive.files.get({
          fileId: folderId,
          fields: "id, name, mimeType, trashed, driveId",
          supportsAllDrives: false,
        });
        return res.data;
      },
      clearLink: async (error) => {
        logger.warn(
          {
            userId,
            folderId: user.googleDriveFolderId,
            status: error?.response?.status,
            reason: error?.response?.data?.error?.errors?.[0]?.reason,
            message: error?.response?.data?.error?.message || error?.message,
          },
          "Liên kết Google: folder làm việc không còn hợp lệ, xoá liên kết trong DB",
        );
        await unlinkGoogleDriveForUser(userId);
      },
    });
    return status;
  } catch (error) {
    logger.warn(
      {
        userId,
        folderId: user.googleDriveFolderId,
        status: error.response?.status,
        reason: error.response?.data?.error?.errors?.[0]?.reason,
        message: error.response?.data?.error?.message || error.message,
      },
      "Liên kết Google: không kiểm tra được folder làm việc, giữ nguyên liên kết",
    );
    return { status: "unchecked" };
  }
}

function getSystemChungTuDriveOAuthClient() {
  const refresh = String(config.google.chungTuSystemDriveRefreshToken || "").trim();
  if (!refresh) {
    throw new AppError({
      message:
        "Chưa cấu hình Google Drive cho mẫu chứng từ quyết toán (CHUNG_TU_SYSTEM_DRIVE_REFRESH_TOKEN — refresh token tài khoản chứa thư mục mẫu, thường superadmin / GMAIL_SENDER).",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  const client = getOAuthClient();
  if (!client) {
    throw new AppError({
      message: "Google OAuth chưa được cấu hình (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI).",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  client.setCredentials({ refresh_token: refresh });
  return client;
}

/** OAuth client hệ thống đã làm mới access token (fetch trực tiếp, tránh lỗi gaxios Premature close). */
async function createSystemChungTuDriveOAuthClient() {
  const client = getSystemChungTuDriveOAuthClient();
  return prepareDriveOAuthClient(client);
}

async function prepareSystemChungTuDriveOAuthClient(oauth2Client) {
  return prepareDriveOAuthClient(oauth2Client);
}

/**
 * Thư mục pool mẫu trên Drive tài khoản hệ thống: `CHUNG_TU_SYSTEM_TEMPLATE_FOLDER_ID` hoặc tự tạo `midnight-app/chung-tu-quyet-toan-template`.
 */
async function resolveSystemChungTuTemplateFolder(oauth2Client) {
  const drive = createDriveClient(oauth2Client);
  const explicitId = String(config.google.chungTuSystemTemplateFolderId || "").trim();

  if (explicitId) {
    const meta = await drive.files.get({
      fileId: explicitId,
      fields: "id, name, webViewLink, mimeType, trashed, driveId",
      supportsAllDrives: false,
    });
    const data = meta.data;
    if (data.trashed || data.mimeType !== DRIVE_FOLDER_MIME_TYPE || data.driveId) {
      throw new AppError({
        message:
          "CHUNG_TU_SYSTEM_TEMPLATE_FOLDER_ID không hợp lệ hoặc là Shared Drive (chỉ hỗ trợ folder trong My Drive tài khoản hệ thống).",
        statusCode: 503,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      });
    }
    return {
      templateFolderId: data.id,
      templateFolderWebViewLink: data.webViewLink ?? null,
      templateFolderName: data.name ?? null,
    };
  }

  const midnightId = await ensureMidnightAppFolder(oauth2Client);
  const templateFolderId = await ensureChildFolder({
    oauth2Client,
    parentId: midnightId,
    folderName: CHUNG_TU_QUYET_TOAN_TEMPLATE_FOLDER_NAME,
  });
  const folderMeta = await drive.files.get({
    fileId: templateFolderId,
    fields: "id, name, webViewLink",
    supportsAllDrives: false,
  });
  return {
    templateFolderId,
    templateFolderWebViewLink: folderMeta.data.webViewLink ?? null,
    templateFolderName: folderMeta.data.name ?? null,
  };
}

export {
  buildGoogleAuthUrl,
  CHUNG_TU_QUYET_TOAN_TEMPLATE_FOLDER_NAME,
  createSystemChungTuDriveOAuthClient,
  createUserChungTuDriveOAuthClient,
  ensureChildFolder,
  exchangeCodeAndLinkDrive,
  getOAuthClient,
  getSystemChungTuDriveOAuthClient,
  getUserChungTuDriveContext,
  MIDNIGHT_APP_FOLDER_NAME,
  resolveSystemChungTuTemplateFolder,
  unlinkGoogleDriveForUser,
  verifyDriveFolderOrClearLink,
  verifyGoogleDriveLinkForUser,
};
