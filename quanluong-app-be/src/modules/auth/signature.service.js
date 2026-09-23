import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { logger } from "../../shared/utils/logger.js";
import { processAndValidateSignaturePng } from "./signature-processing.service.js";

/**
 * Chuyển URL public (/media/signatures/...) → đường dẫn tuyệt đối an toàn dưới MEDIA_ROOT/signatures.
 */
function resolveSignatureDiskPath(publicUrl) {
  if (!publicUrl || typeof publicUrl !== "string") {
    return null;
  }
  const prefix = config.media.publicPath;
  if (!publicUrl.startsWith(`${prefix}/signatures/`)) {
    return null;
  }
  const rel = publicUrl.slice(prefix.length + 1);
  const full = path.resolve(path.join(config.media.root, rel));
  const signaturesRoot = path.resolve(path.join(config.media.root, "signatures"));
  if (!full.startsWith(signaturesRoot + path.sep) && full !== signaturesRoot) {
    return null;
  }
  return full;
}

async function tryUnlinkPublicSignature(publicUrl) {
  const disk = resolveSignatureDiskPath(publicUrl);
  if (!disk) {
    return;
  }
  try {
    await fs.unlink(disk);
  } catch (e) {
    if (e?.code !== "ENOENT") {
      logger.warn({ err: e, disk }, "Không xóa được file chữ ký cũ");
    }
  }
}

/**
 * Lưu PNG chữ ký từ staging → signatures/, cập nhật profile.signatureUrl.
 * @param {number} userId
 * @param {string} stagingAbsolutePath
 */
async function setOwnSignatureFromStaging(userId, stagingAbsolutePath) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      profile: { select: { signatureUrl: true } },
    },
  });

  if (!user) {
    throw new AppError({
      message: "Không tìm thấy tài khoản.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  // Validate PNG+alpha, crop lề trong suốt thừa, re-encode — trước khi lưu public.
  const processed = await processAndValidateSignaturePng(stagingAbsolutePath);
  logger.info(
    { userId, ...processed },
    "Đã xử lý ảnh chữ ký (validate + crop trong suốt)",
  );

  const signaturesDir = path.join(config.media.root, "signatures");
  await fs.mkdir(signaturesDir, { recursive: true });
  const destName = `${userId}-${Date.now()}.png`;
  const destAbs = path.join(signaturesDir, destName);
  await fs.rename(stagingAbsolutePath, destAbs).catch(async (err) => {
    if (err?.code === "EXDEV") {
      await fs.copyFile(stagingAbsolutePath, destAbs);
      await fs.unlink(stagingAbsolutePath).catch(() => {});
      return;
    }
    throw err;
  });

  const publicUrl = `${config.media.publicPath}/signatures/${destName}`;
  const oldUrl = user.profile?.signatureUrl ?? null;

  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      fullName: user.username || "User",
      signatureUrl: publicUrl,
    },
    update: {
      signatureUrl: publicUrl,
    },
  });

  if (oldUrl && oldUrl !== publicUrl) {
    await tryUnlinkPublicSignature(oldUrl);
  }

  return { publicUrl, processed };
}

async function removeOwnSignature(userId) {
  const row = await prisma.profile.findUnique({
    where: { userId },
    select: { signatureUrl: true },
  });
  const url = row?.signatureUrl;
  if (!url) {
    return { removed: false };
  }

  await prisma.profile.update({
    where: { userId },
    data: { signatureUrl: null },
  });

  await tryUnlinkPublicSignature(url);
  return { removed: true };
}

/**
 * Đọc file chữ ký → data URL base64 (để gửi document-service). Không có file → null.
 */
async function readSignatureAsDataUrl(publicUrl) {
  const disk = resolveSignatureDiskPath(publicUrl);
  if (!disk) return null;
  try {
    const buf = await fs.readFile(disk);
    if (!buf?.length) return null;
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch (e) {
    if (e?.code !== "ENOENT") {
      logger.warn({ err: e, disk }, "Không đọc được ảnh chữ ký");
    }
    return null;
  }
}

async function loadUserSignatureDataUrl(userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) return null;
  const row = await prisma.profile.findUnique({
    where: { userId: uid },
    select: { signatureUrl: true },
  });
  if (!row?.signatureUrl) return null;
  return readSignatureAsDataUrl(row.signatureUrl);
}

export {
  loadUserSignatureDataUrl,
  readSignatureAsDataUrl,
  removeOwnSignature,
  resolveSignatureDiskPath,
  setOwnSignatureFromStaging,
  tryUnlinkPublicSignature,
};
