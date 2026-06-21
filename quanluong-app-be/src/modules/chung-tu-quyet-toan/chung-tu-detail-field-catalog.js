/**
 * Logic fill dữ liệu cho cột bảng chi tiết chứng từ — map từ LTTP / chỉ số dòng.
 * fieldKey dùng thống nhất backend + UI mapping.
 */
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

export const CHUNG_TU_DETAIL_FIELD_KEYS = new Set(
  CHUNG_TU_DETAIL_FIELD_CATALOG.map((item) => item.fieldKey),
);

const FIELD_LABEL_BY_KEY = Object.fromEntries(
  CHUNG_TU_DETAIL_FIELD_CATALOG.map((item) => [item.fieldKey, item.label]),
);

/** Đoán fieldKey từ tiêu đề cột trên mẫu (Sheets / Excel). */
export function guessDetailFieldKeyFromLabel(label) {
  const text = String(label ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  if (!text) return "";
  if (/\bstt\b|so thu tu/.test(text)) return "stt";
  if (/ten.*hang|mat hang|hang hoa|thuc pham|noi dung/.test(text)) return "tenHang";
  if (/\bma\b|ma so|ma hang|sku/.test(text)) return "maSo";
  if (/dvt|don vi tinh/.test(text)) return "dvt";
  if (/nguoi.*ban|ben ban|nha cung cap|ncc/.test(text)) return "nguoiBan";
  if (/yeu cau|theo nhu cau|dat hang/.test(text)) return "yeuCau";
  if (/thuc nhap|nhap thuc te/.test(text)) return "thucNhap";
  if (/thuc xuat|xuat thuc te/.test(text)) return "thucXuat";
  if (/so luong|\bsl\b/.test(text)) return "soLuong";
  if (/don gia|gia ban|gia xuat/.test(text)) return "donGia";
  if (/thanh tien|tong tien|so tien/.test(text)) return "thanhTien";
  if (/ghi chu|dien giai/.test(text)) return "ghiChu";
  return "";
}

export function detailFieldLabel(fieldKey) {
  return FIELD_LABEL_BY_KEY[String(fieldKey ?? "").trim()] ?? fieldKey;
}

/**
 * Chuẩn hóa columnMappings từ fillRules (hỗ trợ legacy `columns: string[]`).
 * @returns {{ col: number, label: string, fieldKey: string }[]}
 */
export function resolveDetailColumnMappings(detailTable, defaultStartCol = 0) {
  if (!detailTable || typeof detailTable !== "object") return [];

  const rawMappings = Array.isArray(detailTable.columnMappings) ? detailTable.columnMappings : [];
  if (rawMappings.length) {
    return rawMappings
      .map((item, index) => {
        const col = Number.isFinite(Number(item?.col))
          ? Number(item.col)
          : (Number(defaultStartCol) || 0) + index;
        const fieldKey = String(item?.fieldKey ?? "").trim();
        const label = String(item?.label ?? "").trim() || detailFieldLabel(fieldKey);
        if (!fieldKey || !CHUNG_TU_DETAIL_FIELD_KEYS.has(fieldKey)) return null;
        return { col, label, fieldKey };
      })
      .filter(Boolean)
      .sort((a, b) => a.col - b.col);
  }

  const legacyCols = Array.isArray(detailTable.columns) ? detailTable.columns : [];
  const startCol = Number.isFinite(Number(detailTable.startCol)) ? Number(detailTable.startCol) : 0;
  return legacyCols
    .map((fieldKey, index) => {
      const key = String(fieldKey ?? "").trim();
      if (!key) return null;
      return {
        col: startCol + index,
        label: detailFieldLabel(key),
        fieldKey: key,
      };
    })
    .filter(Boolean);
}

/** Danh sách fieldKey theo thứ tự cột (legacy helpers). */
export function detailColumnFieldKeys(detailTable) {
  return resolveDetailColumnMappings(detailTable).map((item) => item.fieldKey);
}

export function resolveAmountColumnIndex(columnMappings, amountFieldKey = "thanhTien") {
  const key = String(amountFieldKey ?? "thanhTien").trim() || "thanhTien";
  const idx = columnMappings.findIndex((item) => item.fieldKey === key);
  return idx >= 0 ? idx : Math.max(columnMappings.length - 1, 0);
}
