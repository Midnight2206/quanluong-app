/**
 * Số in theo tập quán VN: hàng nghìn tách bằng dấu chấm, thập phân bằng dấu phẩy.
 * Dùng `Intl` với `vi-VN` (Widely matches Excel VN: 1.234,5).
 */

function formatVnIntDot(value) {
  if (value === "" || value == null) {
    return "";
  }
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Số thực/SL — tối đa `maxFractionDigits` (thường 4).
 * @param {string|number} value
 * @param {number} [maxFractionDigits=4]
 */
function formatVnQtyComma(value, maxFractionDigits = 4) {
  if (value === "" || value == null) {
    return "—";
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(n);
}

export { formatVnIntDot, formatVnQtyComma };
