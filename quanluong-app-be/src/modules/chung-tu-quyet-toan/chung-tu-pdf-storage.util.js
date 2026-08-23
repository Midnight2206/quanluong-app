import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

export function buildChungTuPdfRelativePath({ categoryKey, exportKey, year }) {
  return path.posix.join(
    "chung-tu-pdf",
    String(categoryKey),
    String(year),
    `${exportKey}.pdf`,
  );
}

export async function writeChungTuPdfFile(relativePath, buffer, rootDir = env.mediaRoot) {
  const abs = path.join(rootDir, relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return abs;
}

export async function readChungTuPdfFile(relativePath, rootDir = env.mediaRoot) {
  const abs = path.join(rootDir, relativePath);
  return fs.readFile(abs);
}

export async function deleteChungTuPdfFile(relativePath, rootDir = env.mediaRoot) {
  const abs = path.join(rootDir, relativePath);
  try {
    await fs.unlink(abs);
  } catch (e) {
    if (e?.code !== "ENOENT") {
      throw e;
    }
  }
}
