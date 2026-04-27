/** Định dạng số lượng: phân tách hàng nghìn, tối đa `maxFrac` chữ số thập phân. */
function formatQuantityVi(value, { maxFractionDigits = 4 } = {}) {
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

export { formatQuantityVi };
