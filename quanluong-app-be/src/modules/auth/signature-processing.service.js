import fs from "node:fs/promises";
import sharp from "sharp";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  SIGNATURE_CONTENT_ALPHA_MIN,
  SIGNATURE_CROP_PAD_PX,
  SIGNATURE_HARD_HEIGHT_MAX,
  SIGNATURE_HARD_HEIGHT_MIN,
  SIGNATURE_HARD_WIDTH_MAX,
  SIGNATURE_HARD_WIDTH_MIN,
  SIGNATURE_MIN_TRANSPARENT_RATIO,
  SIGNATURE_TRANSPARENT_ALPHA_MAX,
} from "./signature-processing.constants.js";

function validationError(message, details) {
  return new AppError({
    message,
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    details,
  });
}

/**
 * Tìm bbox pixel có alpha > contentMin; trả null nếu không có nội dung.
 * @param {Buffer} raw RGBA
 * @param {number} width
 * @param {number} height
 */
function findContentBoundingBox(raw, width, height, contentAlphaMin = SIGNATURE_CONTENT_ALPHA_MIN) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let contentCount = 0;
  let transparentCount = 0;
  const total = width * height;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const a = raw[i + 3];
      if (a < SIGNATURE_TRANSPARENT_ALPHA_MAX) {
        transparentCount += 1;
      }
      if (a > contentAlphaMin) {
        contentCount += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || contentCount === 0) {
    return { empty: true, contentCount, transparentCount, total };
  }

  return {
    empty: false,
    contentCount,
    transparentCount,
    total,
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
  };
}

/**
 * Validate + crop lề trong suốt thừa; ghi đè stagingPath bằng PNG đã xử lý.
 * @param {string} stagingPath
 * @returns {Promise<{ width: number, height: number, bytes: number, cropped: boolean }>}
 */
async function processAndValidateSignaturePng(stagingPath) {
  let meta;
  try {
    meta = await sharp(stagingPath, { failOn: "truncated" }).metadata();
  } catch {
    throw validationError("File không phải PNG hợp lệ. Hãy xuất lại ảnh chữ ký dạng PNG.");
  }

  if (String(meta.format || "").toLowerCase() !== "png") {
    throw validationError("Chỉ chấp nhận ảnh chữ ký PNG (không phải JPEG/WebP đổi đuôi).");
  }

  const width = Number(meta.width) || 0;
  const height = Number(meta.height) || 0;
  if (width < SIGNATURE_HARD_WIDTH_MIN || width > SIGNATURE_HARD_WIDTH_MAX) {
    throw validationError(
      `Chiều rộng ảnh chữ ký phải từ ${SIGNATURE_HARD_WIDTH_MIN}–${SIGNATURE_HARD_WIDTH_MAX}px (khuyến nghị 500–1000px). Ảnh hiện tại: ${width}px.`,
      { width, height },
    );
  }
  if (height < SIGNATURE_HARD_HEIGHT_MIN || height > SIGNATURE_HARD_HEIGHT_MAX) {
    throw validationError(
      `Chiều cao ảnh chữ ký phải từ ${SIGNATURE_HARD_HEIGHT_MIN}–${SIGNATURE_HARD_HEIGHT_MAX}px. Ảnh hiện tại: ${height}px.`,
      { width, height },
    );
  }

  // Ép decode RGBA để kiểm tra alpha thật (JPEG đổi đuôi thường không có alpha).
  const { data: raw, info } = await sharp(stagingPath, { failOn: "truncated" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  if (channels < 4 && !meta.hasAlpha) {
    throw validationError(
      "Ảnh chữ ký phải có nền trong suốt (kênh alpha). Không chấp nhận ảnh nền trắng/đặc.",
    );
  }

  // hasAlpha từ metadata: PNG RGB không alpha → reject dù ensureAlpha đã thêm alpha=255
  if (!meta.hasAlpha) {
    throw validationError(
      "Ảnh chữ ký phải là PNG có nền trong suốt (có kênh alpha). Hãy xuất PNG transparent, không phải nền trắng.",
    );
  }

  const box = findContentBoundingBox(raw, info.width, info.height);
  if (box.empty) {
    throw validationError("Không nhận diện được nét chữ ký (ảnh trống hoặc gần như trong suốt hoàn toàn).");
  }

  const transparentRatio = box.transparentCount / Math.max(box.total, 1);
  if (transparentRatio < SIGNATURE_MIN_TRANSPARENT_RATIO) {
    throw validationError(
      "Ảnh thiếu nền trong suốt đáng kể (có vẻ nền đặc/trắng). Hãy dùng PNG chữ ký nền transparent.",
      { transparentRatio },
    );
  }

  const pad = SIGNATURE_CROP_PAD_PX;
  const left = Math.max(0, box.left - pad);
  const top = Math.max(0, box.top - pad);
  const right = Math.min(info.width - 1, box.right + pad);
  const bottom = Math.min(info.height - 1, box.bottom + pad);
  const cropW = right - left + 1;
  const cropH = bottom - top + 1;

  const needsCrop =
    left > 0 || top > 0 || right < info.width - 1 || bottom < info.height - 1;

  let pipeline = sharp(stagingPath, { failOn: "truncated" }).ensureAlpha();
  if (needsCrop) {
    pipeline = pipeline.extract({ left, top, width: cropW, height: cropH });
  }

  const outBuffer = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  await fs.writeFile(stagingPath, outBuffer);

  const outMeta = await sharp(stagingPath).metadata();
  return {
    width: outMeta.width ?? cropW,
    height: outMeta.height ?? cropH,
    bytes: outBuffer.length,
    cropped: needsCrop,
  };
}

export { findContentBoundingBox, processAndValidateSignaturePng };
