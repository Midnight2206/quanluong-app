import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { logger } from "../../shared/utils/logger.js";
import { setOwnAvatarPublicUrl } from "./avatar.service.js";

const MAX_AVATAR_PX = 512;

function assertStagingPathUnderRoot(stagingRelativePath) {
  if (!stagingRelativePath || typeof stagingRelativePath !== "string") {
    throw new AppError({
      message: "Đường dẫn staging không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const normalized = stagingRelativePath.replace(/\\/g, "/");
  if (normalized.includes("..") || !normalized.startsWith("staging/")) {
    throw new AppError({
      message: "Đường dẫn staging không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const base = path.resolve(config.media.root);
  const full = path.resolve(path.join(config.media.root, normalized));
  const stagingRoot = path.resolve(path.join(config.media.root, "staging"));
  if (!full.startsWith(stagingRoot + path.sep)) {
    throw new AppError({
      message: "Đường dẫn staging không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return full;
}

function clampCrop(crop, imgWidth, imgHeight) {
  if (!crop || !imgWidth || !imgHeight) {
    return null;
  }
  let left = Math.max(0, Math.floor(crop.x));
  let top = Math.max(0, Math.floor(crop.y));
  let width = Math.max(1, Math.floor(crop.width));
  let height = Math.max(1, Math.floor(crop.height));

  if (left >= imgWidth || top >= imgHeight) {
    return null;
  }
  width = Math.min(width, imgWidth - left);
  height = Math.min(height, imgHeight - top);
  if (width < 1 || height < 1) {
    return null;
  }
  return { left, top, width, height };
}

/**
 * Đọc file staging → (tuỳ chọn) crop pixel → resize → WebP → avatars/ → cập nhật DB → xóa staging.
 */
async function finalizeAvatarFromStaging({ userId, stagingRelativePath, crop }) {
  const stagingFull = assertStagingPathUnderRoot(stagingRelativePath);

  const meta = await sharp(stagingFull, { failOn: "truncated" }).metadata();
  const imgWidth = meta.width ?? 0;
  const imgHeight = meta.height ?? 0;

  const extract = clampCrop(crop, imgWidth, imgHeight);
  let pipeline = sharp(stagingFull, { failOn: "truncated" });
  if (extract) {
    pipeline = pipeline.extract(extract);
  }

  const outName = `${userId}-${randomUUID()}.webp`;
  const avatarsDir = path.join(config.media.root, "avatars");
  await fs.mkdir(avatarsDir, { recursive: true });
  const outPath = path.join(avatarsDir, outName);

  await pipeline
    .resize(MAX_AVATAR_PX, MAX_AVATAR_PX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toFile(outPath);

  await fs.unlink(stagingFull).catch((e) => {
    if (e?.code !== "ENOENT") {
      logger.warn({ err: e, stagingFull }, "Không xóa được file staging avatar");
    }
  });

  const publicUrl = `${config.media.publicPath}/avatars/${outName}`;
  await setOwnAvatarPublicUrl(userId, publicUrl);

  return { publicUrl };
}

/**
 * Xóa file staging khi job lỗi (ảnh hỏng, crop sai, v.v.).
 */
async function unlinkStagingSafe(stagingRelativePath) {
  try {
    const full = assertStagingPathUnderRoot(stagingRelativePath);
    await fs.unlink(full);
  } catch (e) {
    if (e instanceof AppError) {
      return;
    }
    if (e?.code !== "ENOENT") {
      logger.warn({ err: e, stagingRelativePath }, "Không xóa staging sau lỗi avatar");
    }
  }
}

export { assertStagingPathUnderRoot, finalizeAvatarFromStaging, unlinkStagingSafe };
