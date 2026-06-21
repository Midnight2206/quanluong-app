import { createDriveClient } from "../../shared/utils/google-drive-fetch.api.js";
import { createSystemChungTuDriveOAuthClient } from "../auth/google-drive-link.service.js";

export function isDriveFileMissingError(error) {
  const status = error?.response?.status;
  const reason = error?.response?.data?.error?.errors?.[0]?.reason;
  return status === 404 || reason === "notFound";
}

export async function getDriveFileAvailability({ oauth2Client, fileId }) {
  const id = String(fileId ?? "").trim();
  if (!id) return { exists: false, reason: "missing-id" };

  const drive = createDriveClient(oauth2Client);
  try {
    const res = await drive.files.get({
      fileId: id,
      fields: "id, trashed, webViewLink",
      supportsAllDrives: false,
    });
    if (res.data.trashed) {
      return { exists: false, reason: "trashed" };
    }
    return {
      exists: true,
      webViewLink: res.data.webViewLink ?? null,
    };
  } catch (error) {
    if (isDriveFileMissingError(error)) {
      return { exists: false, reason: "not-found" };
    }
    throw error;
  }
}

export async function getSystemDriveFileAvailability(fileId) {
  const oauth2Client = await createSystemChungTuDriveOAuthClient();
  return getDriveFileAvailability({ oauth2Client, fileId });
}

export async function trashSystemDriveFileIfExists(fileId) {
  const id = String(fileId ?? "").trim();
  if (!id) return { trashed: false, reason: "missing-id" };

  const oauth2Client = await createSystemChungTuDriveOAuthClient();
  const drive = createDriveClient(oauth2Client);
  try {
    await drive.files.update({
      fileId: id,
      requestBody: { trashed: true },
      fields: "id, trashed",
      supportsAllDrives: false,
    });
    return { trashed: true };
  } catch (error) {
    if (isDriveFileMissingError(error)) {
      return { trashed: false, reason: "not-found" };
    }
    throw error;
  }
}
