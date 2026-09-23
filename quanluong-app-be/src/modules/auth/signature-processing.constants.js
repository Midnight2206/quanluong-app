/** Quy tắc ảnh chữ ký PNG — một chỗ chỉnh (BE + FE nên đồng bộ message). */

/** Hard limit multer / FE reject */
export const SIGNATURE_HARD_MAX_BYTES = 2 * 1024 * 1024;

/** Khuyến nghị: dưới mức này là tốt (FE soft-warn nếu vượt) */
export const SIGNATURE_RECOMMENDED_MAX_BYTES = 500 * 1024;

/** Chiều rộng upload khuyến nghị (px) */
export const SIGNATURE_RECOMMENDED_WIDTH_MIN = 500;
export const SIGNATURE_RECOMMENDED_WIDTH_MAX = 1000;

/** Hard reject ngoài khoảng này (px) — quá nhỏ/lớn rõ ràng */
export const SIGNATURE_HARD_WIDTH_MIN = 150;
export const SIGNATURE_HARD_WIDTH_MAX = 2500;

/** Hard reject chiều cao ngoài khoảng (px) */
export const SIGNATURE_HARD_HEIGHT_MIN = 40;
export const SIGNATURE_HARD_HEIGHT_MAX = 2000;

/** Alpha > ngưỡng được coi là «có nét chữ» */
export const SIGNATURE_CONTENT_ALPHA_MIN = 12;

/** Pixel alpha < ngưỡng được coi là «trong suốt / gần trong suốt» */
export const SIGNATURE_TRANSPARENT_ALPHA_MAX = 240;

/** Tối thiểu tỉ lệ pixel trong suốt (0–1) để chấp nhận nền trong suốt */
export const SIGNATURE_MIN_TRANSPARENT_RATIO = 0.05;

/** Padding quanh bbox khi crop (px) */
export const SIGNATURE_CROP_PAD_PX = 4;
