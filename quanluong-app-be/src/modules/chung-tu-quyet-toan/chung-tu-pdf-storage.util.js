import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

function resolveChungTuPdfAbsolutePath(relativePath, rootDir = env.mediaRoot) {
  const safeRootDir = path.resolve(rootDir);
  const targetPath = path.resolve(safeRootDir, String(relativePath ?? ""));
  const relativeToRoot = path.relative(safeRootDir, targetPath);
  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new AppError({
      message: "Đường dẫn file PDF không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return targetPath;
}

export function buildChungTuPdfRelativePath({ categoryKey, exportKey, year }) {
  return path.posix.join(
    "chung-tu-pdf",
    String(categoryKey),
    String(year),
    `${exportKey}.pdf`,
  );
}

export async function writeChungTuPdfFile(relativePath, buffer, rootDir = env.mediaRoot) {
  const abs = resolveChungTuPdfAbsolutePath(relativePath, rootDir);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return abs;
}

export async function readChungTuPdfFile(relativePath, rootDir = env.mediaRoot) {
  const abs = resolveChungTuPdfAbsolutePath(relativePath, rootDir);
  return fs.readFile(abs);
}

export async function deleteChungTuPdfFile(relativePath, rootDir = env.mediaRoot) {
  const abs = resolveChungTuPdfAbsolutePath(relativePath, rootDir);
  try {
    await fs.unlink(abs);
  } catch (e) {
    if (e?.code !== "ENOENT") {
      throw e;
    }
  }
}
