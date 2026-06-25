/**
 * Sao chép mẫu chứng từ quyết toán từ Drive tài khoản hệ thống sang Drive của user.
 * Cross-account: token hệ thống chia sẻ quyền reader cho email user trên từng file mẫu,
 * sau đó token user `files.copy` vào folder loại của user (user sở hữu bản sao). Bỏ qua mẫu trùng tên.
 */
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { logger } from "../../shared/utils/logger.js";
import { createDriveClient } from "../../shared/utils/google-drive-fetch.api.js";
import {
  createSystemChungTuDriveOAuthClient,
  ensureChildFolder,
  getUserChungTuDriveContext,
  resolveSystemChungTuTemplateFolder,
} from "../auth/google-drive-link.service.js";
import { CHUNG_TU_CATEGORY_LIST } from "./chung-tu-category.constants.js";

const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

async function listTemplatesInFolder(drive, folderId) {
  const items = [];
  let pageToken;
  do {
    const list = await drive.files.list({
      q: [
        `'${folderId}' in parents`,
        `(mimeType='${GOOGLE_SHEET_MIME}' or mimeType='${GOOGLE_DOC_MIME}')`,
        "trashed=false",
      ].join(" and "),
      fields: "nextPageToken, files(id, name, mimeType, driveId)",
      spaces: "drive",
      corpora: "user",
      pageSize: 200,
      pageToken,
      supportsAllDrives: false,
    });
    for (const f of list.data.files ?? []) {
      if (!f.id || !f.name || f.driveId) continue;
      items.push({ id: f.id, name: f.name, mimeType: f.mimeType });
    }
    pageToken = list.data.nextPageToken;
  } while (pageToken);
  return items;
}

async function resolveUserGoogleEmail(userDrive) {
  try {
    const res = await userDrive.about.get({ fields: "user(emailAddress)" });
    return String(res.data?.user?.emailAddress ?? "").trim();
  } catch (error) {
    logger.warn({ message: error?.message }, "Seed mẫu: không lấy được email Google của user");
    return "";
  }
}

async function shareTemplateToUser(systemDrive, fileId, email) {
  if (!email) return;
  try {
    await systemDrive.permissions.create({
      fileId,
      sendNotificationEmail: false,
      supportsAllDrives: false,
      requestBody: { role: "reader", type: "user", emailAddress: email },
    });
  } catch (error) {
    // Đã chia sẻ trước đó hoặc lỗi tạm thời — best-effort, vẫn thử copy bên dưới.
    logger.debug(
      { fileId, message: error?.response?.data?.error?.message || error?.message },
      "Seed mẫu: chia sẻ file hệ thống cho user gặp lỗi (bỏ qua)",
    );
  }
}

/**
 * @param {{ userId: number }} args
 * @returns {Promise<{ summary: Record<string, {available:number, copied:number, skipped:number}>, totals: {available:number, copied:number, skipped:number} }>}
 */
async function seedUserTemplatesFromSystem({ userId }) {
  const systemClient = await createSystemChungTuDriveOAuthClient();
  const systemDrive = createDriveClient(systemClient);
  const { templateFolderId: systemTemplateRootId } =
    await resolveSystemChungTuTemplateFolder(systemClient);

  const userCtx = await getUserChungTuDriveContext(userId);
  const userDrive = createDriveClient(userCtx.oauth2Client);
  const userEmail = await resolveUserGoogleEmail(userDrive);

  const summary = {};
  const totals = { available: 0, copied: 0, skipped: 0 };

  for (const category of CHUNG_TU_CATEGORY_LIST) {
    const systemCategoryFolderId = await ensureChildFolder({
      oauth2Client: systemClient,
      parentId: systemTemplateRootId,
      folderName: category.folderName,
    });
    const userCategoryFolderId = await ensureChildFolder({
      oauth2Client: userCtx.oauth2Client,
      parentId: userCtx.templateRootFolderId,
      folderName: category.folderName,
    });

    const systemTemplates = await listTemplatesInFolder(systemDrive, systemCategoryFolderId);
    const existing = await listTemplatesInFolder(userDrive, userCategoryFolderId);
    const existingNames = new Set(existing.map((t) => t.name.trim().toLowerCase()));

    const stat = { available: systemTemplates.length, copied: 0, skipped: 0 };

    for (const template of systemTemplates) {
      if (existingNames.has(template.name.trim().toLowerCase())) {
        stat.skipped += 1;
        continue;
      }
      await shareTemplateToUser(systemDrive, template.id, userEmail);
      try {
        await userDrive.files.copy({
          fileId: template.id,
          requestBody: { name: template.name, parents: [userCategoryFolderId] },
          fields: "id, name",
          supportsAllDrives: false,
        });
        stat.copied += 1;
        existingNames.add(template.name.trim().toLowerCase());
      } catch (error) {
        logger.warn(
          {
            userId,
            categoryKey: category.key,
            templateName: template.name,
            message: error?.response?.data?.error?.message || error?.message,
          },
          "Seed mẫu: không sao chép được mẫu sang Drive user",
        );
      }
    }

    summary[category.key] = stat;
    totals.available += stat.available;
    totals.copied += stat.copied;
    totals.skipped += stat.skipped;
  }

  return { summary, totals };
}

export { seedUserTemplatesFromSystem };
