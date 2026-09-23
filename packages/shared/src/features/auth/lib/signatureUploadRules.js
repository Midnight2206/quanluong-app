/** Đồng bộ với BE signature-processing.constants.js — soft/hard rules phía client. */

export const SIGNATURE_HARD_MAX_BYTES = 2 * 1024 * 1024;
export const SIGNATURE_RECOMMENDED_MAX_BYTES = 500 * 1024;
export const SIGNATURE_RECOMMENDED_WIDTH_MIN = 500;
export const SIGNATURE_RECOMMENDED_WIDTH_MAX = 1000;
export const SIGNATURE_HARD_WIDTH_MIN = 150;
export const SIGNATURE_HARD_WIDTH_MAX = 2500;
export const SIGNATURE_HARD_HEIGHT_MIN = 40;
export const SIGNATURE_HARD_HEIGHT_MAX = 2000;

/**
 * @param {File} file
 * @returns {Promise<{ width: number, height: number }>}
 */
export function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh. Hãy chọn file PNG hợp lệ."));
    };
    img.src = url;
  });
}

/**
 * Precheck rẻ phía client. Server vẫn là nguồn sự thật (alpha + crop).
 * @returns {{ ok: false, message: string } | { ok: true, softWarnings: string[] }}
 */
export function precheckSignatureFile(file, { width, height } = {}) {
  const softWarnings = [];
  if (!file) {
    return { ok: false, message: "Chưa chọn file ảnh chữ ký." };
  }
  if (file.type !== "image/png") {
    return { ok: false, message: "Chỉ chấp nhận ảnh chữ ký PNG nền trong suốt." };
  }
  if (file.size > SIGNATURE_HARD_MAX_BYTES) {
    return {
      ok: false,
      message: "Ảnh chữ ký tối đa 2MB (khuyến nghị dưới 500KB).",
    };
  }
  if (file.size > SIGNATURE_RECOMMENDED_MAX_BYTES) {
    softWarnings.push(
      `File ${(file.size / 1024).toFixed(0)}KB — khuyến nghị dưới 500KB (server sẽ crop/nén nếu được).`,
    );
  }
  if (width != null && height != null) {
    if (width < SIGNATURE_HARD_WIDTH_MIN || width > SIGNATURE_HARD_WIDTH_MAX) {
      return {
        ok: false,
        message: `Chiều rộng phải từ ${SIGNATURE_HARD_WIDTH_MIN}–${SIGNATURE_HARD_WIDTH_MAX}px (khuyến nghị 500–1000px). Ảnh: ${width}px.`,
      };
    }
    if (height < SIGNATURE_HARD_HEIGHT_MIN || height > SIGNATURE_HARD_HEIGHT_MAX) {
      return {
        ok: false,
        message: `Chiều cao phải từ ${SIGNATURE_HARD_HEIGHT_MIN}–${SIGNATURE_HARD_HEIGHT_MAX}px. Ảnh: ${height}px.`,
      };
    }
    if (width < SIGNATURE_RECOMMENDED_WIDTH_MIN || width > SIGNATURE_RECOMMENDED_WIDTH_MAX) {
      softWarnings.push(
        `Chiều rộng ${width}px — khuyến nghị ${SIGNATURE_RECOMMENDED_WIDTH_MIN}–${SIGNATURE_RECOMMENDED_WIDTH_MAX}px.`,
      );
    }
  }
  return { ok: true, softWarnings };
}
