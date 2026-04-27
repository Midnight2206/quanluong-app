/**
 * Liên kết Drive của user — Google Drive API v3, scope drive.file (file/thư mục do app tạo).
 * Gmail gửi thư hệ thống dùng Gmail API riêng (MAIL_TRANSPORT=gmail_api + GMAIL_SENDER_*).
 */
import { google } from "googleapis";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { logger } from "../../shared/utils/logger.js";

const MIDNIGHT_APP_FOLDER_NAME = "midnight-app";
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FOLDER_HEALTH_ATTEMPTS = 3;
const DRIVE_FOLDER_HEALTH_RETRY_DELAY_MS = 300;

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
      "https://www.googleapis.com/auth/drive.file",
    ],
    state,
  });
}

async function ensureMidnightAppFolder(oauth2Client) {
  const drive = google.drive({ version: "v3", auth: oauth2Client });
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

function assertDriveFileScopeGranted(tokens) {
  const grantedScopes = String(tokens.scope || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!grantedScopes.includes(DRIVE_FILE_SCOPE)) {
    logger.warn({ grantedScopes }, "Liên kết Google: OAuth token thiếu scope drive.file");
    throw new AppError({
      message: "Google không cấp quyền tạo thư mục Drive cho ứng dụng.",
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

  assertDriveFileScopeGranted(tokens);

  client.setCredentials(tokens);

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
  const drive = google.drive({ version: "v3", auth: client });

  try {
    return await verifyDriveFolderOrClearLink({
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

export {
  buildGoogleAuthUrl,
  exchangeCodeAndLinkDrive,
  getOAuthClient,
  MIDNIGHT_APP_FOLDER_NAME,
  unlinkGoogleDriveForUser,
  verifyDriveFolderOrClearLink,
  verifyGoogleDriveLinkForUser,
};
