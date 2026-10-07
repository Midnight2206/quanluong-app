import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function backupRoot() {
  return process.env.BACKUP_DIR || "/var/backups/quanluong";
}

function isBackupDate(value) {
  return DATE_RE.test(String(value || ""));
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

function idleStatus(message = "") {
  return { state: "idle", date: null, message, at: null };
}

async function readBackupState(root = backupRoot()) {
  try {
    await access(root);
  } catch {
    return {
      mounted: false,
      keep: 10,
      updatedAt: null,
      driveReady: false,
      versions: [],
      status: idleStatus("Chưa gắn thư mục backup."),
    };
  }
  const manifest = await readJson(path.join(root, "manifest.json"));
  const status = await readJson(path.join(root, "status.json"));
  const versions = Array.isArray(manifest?.versions)
    ? manifest.versions.filter((row) => row && isBackupDate(row.date))
    : [];
  return {
    mounted: true,
    keep: Number(manifest?.keep) || 10,
    updatedAt: manifest?.updatedAt ?? null,
    driveReady: Boolean(manifest?.driveReady),
    versions,
    status: status && typeof status.state === "string" ? status : idleStatus(),
  };
}

async function queueRestore(date, root = backupRoot()) {
  if (!isBackupDate(date)) {
    throw new AppError({
      message: "Ngày không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const state = await readBackupState(root);
  if (!state.mounted) {
    throw new AppError({
      message: "Chưa gắn thư mục backup.",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  if (!state.versions.some((row) => row.date === date)) {
    throw new AppError({
      message: "Không có phiên bản ngày này.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (state.status?.state === "running") {
    throw new AppError({
      message: "Đang có một lần khôi phục.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  const reqDir = path.join(root, "requests");
  await mkdir(reqDir, { recursive: true });
  const dest = path.join(reqDir, "restore.json");
  try {
    await stat(dest);
    throw new AppError({
      message: "Đang có một lần khôi phục.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  const now = new Date().toISOString();
  try {
    await writeFile(dest, JSON.stringify({ date, requestedAt: now }), { flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new AppError({
        message: "Đang có một lần khôi phục.",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
  const status = { state: "running", date, message: "Đang khôi phục", at: now };
  await writeFile(path.join(root, "status.json"), `${JSON.stringify(status)}\n`);
  return status;
}

async function queueBackup(root = backupRoot(), now = new Date()) {
  const reqDir = path.join(root, "requests");
  await mkdir(reqDir, { recursive: true });
  try {
    await stat(path.join(reqDir, "restore.json"));
    throw new AppError({
      message: "Đang có một lần khôi phục.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  const requestedAt = now.toISOString();
  try {
    await writeFile(path.join(reqDir, "backup.json"), JSON.stringify({ requestedAt }), { flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new AppError({
        message: "Đang có một lệnh backup.",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
  return { requestedAt };
}

async function readBackupLogTail(root = backupRoot(), limit = 80) {
  try {
    const text = await readFile(path.join(root, "backup.log"), "utf8");
    const lines = text.split("\n");
    if (lines.at(-1) === "") {
      lines.pop();
    }
    return lines.slice(-limit);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export { backupRoot, isBackupDate, queueBackup, queueRestore, readBackupLogTail, readBackupState };
