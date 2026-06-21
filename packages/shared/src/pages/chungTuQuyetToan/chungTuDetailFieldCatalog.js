/** Logic fill cột bảng chi tiết — đồng bộ với backend `chung-tu-detail-field-catalog.js`. */
export const CHUNG_TU_DETAIL_FIELD_CATALOG = Object.freeze([
  { fieldKey: "stt", label: "STT", group: "chung" },
  { fieldKey: "tenHang", label: "Tên mặt hàng", group: "chung" },
  { fieldKey: "maSo", label: "Mã số", group: "chung" },
  { fieldKey: "dvt", label: "Đơn vị tính", group: "chung" },
  { fieldKey: "nguoiBan", label: "Người bán / NCC", group: "chung" },
  { fieldKey: "yeuCau", label: "Yêu cầu (số lượng)", group: "phieu" },
  { fieldKey: "thucXuat", label: "Thực xuất (số lượng)", group: "phieu" },
  { fieldKey: "thucNhap", label: "Thực nhập (số lượng)", group: "phieu" },
  { fieldKey: "soLuong", label: "Số lượng", group: "chung" },
  { fieldKey: "donGia", label: "Đơn giá", group: "chung" },
  { fieldKey: "thanhTien", label: "Thành tiền", group: "chung" },
  { fieldKey: "ghiChu", label: "Ghi chú", group: "chung" },
]);

export const CHUNG_TU_DETAIL_FIELD_LABELS = Object.fromEntries(
  CHUNG_TU_DETAIL_FIELD_CATALOG.map((item) => [item.fieldKey, item.label]),
);

export function detailFieldLabel(fieldKey) {
  return CHUNG_TU_DETAIL_FIELD_LABELS[String(fieldKey ?? "").trim()] ?? fieldKey;
}
