/** Định dạng tiền VNĐ theo locale vi-VN (phân tách hàng nghìn). */
function formatVnd(value) {
  if (value === "" || value == null) {
    return "—";
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "—";
  }
  return `${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)} đ`;
}

export { formatVnd };
