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
      "mimeType='application/vnd.google-apps.folder'",
      "trashed=false",
      "'root' in parents",
    ].join(" and "),
    fields: "files(id, name)",
    pageSize: 10,
  });

  const existing = list.data.files?.[0];
  if (existing?.id) {
    return existing.id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: MIDNIGHT_APP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new AppError({
      message: "Không tạo được thư mục trên Google Drive.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  return created.data.id;
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

  const folderId = await ensureMidnightAppFolder(client);

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

export {
  buildGoogleAuthUrl,
  exchangeCodeAndLinkDrive,
  getOAuthClient,
  MIDNIGHT_APP_FOLDER_NAME,
  unlinkGoogleDriveForUser,
};
