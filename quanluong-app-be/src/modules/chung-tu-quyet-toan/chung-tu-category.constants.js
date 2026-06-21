/** Loại chứng từ quyết toán — khớp tab UI và tên folder con trên Drive hệ thống. */
export const CHUNG_TU_CATEGORY_KEYS = Object.freeze({
  BANG_KE_MUA_HANG: "bang-ke-mua-hang",
  PHIEU_XUAT_KHO: "phieu-xuat-kho",
  PHIEU_NHAP_KHO: "phieu-nhap-kho",
});

export const CHUNG_TU_CATEGORY_LIST = Object.freeze([
  {
    key: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    label: "Bảng kê mua hàng",
    mode: "by-date",
    folderName: "bang-ke-mua-hang",
  },
  {
    key: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
    label: "Phiếu xuất kho",
    mode: "by-date",
    folderName: "phieu-xuat-kho",
  },
  {
    key: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
    label: "Phiếu nhập kho",
    mode: "by-date",
    folderName: "phieu-nhap-kho",
  },
]);

export const CHUNG_TU_TEMPLATE_ROOT_FOLDER_NAME = "chung-tu-quyet-toan-template";
export const CHUNG_TU_GENERATED_ROOT_FOLDER_NAME = "chung-tu-quyet-toan-generated";

export const CHUNG_TU_DOCUMENT_STATUS = Object.freeze({
  DRAFT: "draft",
  SYNCED: "synced",
  STALE: "stale",
  LOCKED: "locked",
});

/** Chế độ gộp dữ liệu LTTP khi xuất chứng từ theo tháng. */
export const CHUNG_TU_AGGREGATION_MODES = Object.freeze({
  BY_DAY: "by-day",
  BY_UNIT: "by-unit",
  FULL: "full",
});

export const CHUNG_TU_AGGREGATION_MODE_LIST = Object.freeze([
  { key: CHUNG_TU_AGGREGATION_MODES.BY_DAY, label: "Theo ngày" },
  { key: CHUNG_TU_AGGREGATION_MODES.BY_UNIT, label: "Theo đơn vị" },
  { key: CHUNG_TU_AGGREGATION_MODES.FULL, label: "Toàn bộ" },
]);

export function getAggregationModeLabel(mode) {
  const key = String(mode ?? "").trim();
  return CHUNG_TU_AGGREGATION_MODE_LIST.find((item) => item.key === key)?.label ?? key;
}

export function normalizeAggregationMode(mode) {
  const key = String(mode ?? "").trim();
  if (Object.values(CHUNG_TU_AGGREGATION_MODES).includes(key)) return key;
  return CHUNG_TU_AGGREGATION_MODES.BY_DAY;
}

/**
 * Tên named range chuẩn (camelCase) trên template Google Sheets — mỗi range một ô.
 */
export const CHUNG_TU_DERIVED_NAMED_RANGE_NAMES = Object.freeze([
  "ngay",
  "thang",
  "nam",
  "ngayThangNam",
  "so",
  "soChungTu",
  "soPhieu",
  "quyenSo",
  "tongTienBangChu",
]);

export const CHUNG_TU_DERIVED_NAMED_RANGE_SET = new Set(CHUNG_TU_DERIVED_NAMED_RANGE_NAMES);

/** Named range bổ sung theo loại chứng từ (ngoài bộ chung). */
export const CHUNG_TU_CATEGORY_EXTRA_DERIVED_NAMED_RANGES = Object.freeze({
  [CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO]: Object.freeze(["canCuBkmh", "nguoiNhanHang", "donVi"]),
  [CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO]: Object.freeze(["nguoiNhanHang", "donVi"]),
});

export function getDerivedNamedRangeNamesForCategory(categoryKey) {
  const key = String(categoryKey ?? "").trim();
  const extra = CHUNG_TU_CATEGORY_EXTRA_DERIVED_NAMED_RANGES[key] ?? [];
  return [...CHUNG_TU_DERIVED_NAMED_RANGE_NAMES, ...extra];
}

export function getDerivedNamedRangeSetForCategory(categoryKey) {
  return new Set(getDerivedNamedRangeNamesForCategory(categoryKey));
}

/** Cấu hình Google Sheets — chiều cao cơ bản 18pt/dòng; wrap đọc từ template. */
export const CHUNG_TU_DEFAULT_SHEET_PRINT = Object.freeze({
  rowHeightPt: 18,
  amountFieldKey: "thanhTien",
  labelFieldKey: "tenHang",
  totalLabel: "Tổng cộng",
});

/** Cấu hình ghi bảng chi tiết mặc định (0-based row/col) khi chưa có fillRules. */
export const CHUNG_TU_DEFAULT_SHEET_TABLE = Object.freeze({
  [CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG]: {
    startRow: 8,
    startCol: 0,
    templateRow: 8,
    totalTemplateRow: 9,
    columns: ["stt", "tenHang", "dvt", "nguoiBan", "soLuong", "donGia", "thanhTien"],
    rowHeightPt: 18,
    totalLabel: "Tổng cộng",
  },
  [CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO]: {
    /** Sheet NHẬP (TỔNG HỢP): tiêu đề TT ~dòng 11, dòng dữ liệu mẫu ~dòng 14 (0-based: 13). */
    sheetName: "NHẬP",
    startRow: 13,
    startCol: 0,
    templateRow: 13,
    totalTemplateRow: 14,
    columns: ["stt", "tenHang", "dvt", "yeuCau", "thucNhap", "donGia", "thanhTien"],
    rowHeightPt: 18,
    totalLabel: "Tổng cộng",
  },
  [CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO]: {
    startRow: 9,
    startCol: 0,
    templateRow: 9,
    totalTemplateRow: 10,
    columns: ["stt", "tenHang", "maSo", "dvt", "yeuCau", "thucXuat", "donGia", "thanhTien"],
    rowHeightPt: 18,
    totalLabel: "Tổng cộng",
  },
});

/**
 * Cột cố định theo loại chứng từ — dùng khi tiêu đề mẫu bị merge (values API chỉ thấy vài ô).
 * Mỗi mẫu vẫn lưu map riêng; đây chỉ là gợi ý ban đầu trên UI.
 */
export const CHUNG_TU_CATEGORY_COLUMN_SLOTS = Object.freeze({
  [CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO]: Object.freeze([
    { col: 0, label: "TT", defaultFieldKey: "stt" },
    { col: 1, label: "Tên, quy cách, phẩm chất vật tư, hàng hóa, dụng cụ", defaultFieldKey: "tenHang" },
    { col: 2, label: "ĐVT", defaultFieldKey: "dvt" },
    { col: 3, label: "Số lượng (yêu cầu)", defaultFieldKey: "yeuCau" },
    { col: 4, label: "Số lượng (Thực nhập)", defaultFieldKey: "thucNhap" },
    { col: 5, label: "Đơn giá", defaultFieldKey: "donGia" },
    { col: 6, label: "Thành tiền", defaultFieldKey: "thanhTien" },
  ]),
  [CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO]: Object.freeze([
    { col: 0, label: "TT", defaultFieldKey: "stt" },
    {
      col: 1,
      label: "Tên nhãn hiệu, quy cách, phẩm chất vật tư, hàng hóa, dụng cụ",
      defaultFieldKey: "tenHang",
    },
    { col: 4, label: "Mã số", defaultFieldKey: "maSo" },
    { col: 5, label: "ĐVT", defaultFieldKey: "dvt" },
    { col: 6, label: "Số lượng (yêu cầu)", defaultFieldKey: "yeuCau" },
    { col: 7, label: "Số lượng (Thực xuất)", defaultFieldKey: "thucXuat" },
    { col: 8, label: "Đơn giá", defaultFieldKey: "donGia" },
    { col: 9, label: "Thành tiền", defaultFieldKey: "thanhTien" },
  ]),
});

export function excelColumnLetter(colIndex) {
  let n = Number(colIndex) || 0;
  let col = "";
  while (n >= 0) {
    col = String.fromCharCode((n % 26) + 65) + col;
    n = Math.floor(n / 26) - 1;
  }
  return col;
}

export function getSuggestedColumnSlotsForCategory(categoryKey) {
  const key = String(categoryKey ?? "").trim();
  const explicit = CHUNG_TU_CATEGORY_COLUMN_SLOTS[key];
  if (explicit?.length) {
    return explicit.map((slot) => ({
      col: slot.col,
      label: slot.label,
      defaultFieldKey: slot.defaultFieldKey ?? "",
    }));
  }
  const def = CHUNG_TU_DEFAULT_SHEET_TABLE[key];
  if (!def?.columns?.length) return [];
  const startCol = Number(def.startCol ?? 0);
  return def.columns.map((fieldKey, index) => ({
    col: startCol + index,
    label: fieldKey,
    defaultFieldKey: fieldKey,
  }));
}

/** Gộp map đã lưu với slot cột cố định theo loại chứng từ (PNK: A–G). */
export function mergeColumnMappingsWithSuggestedSlots(savedMappings, suggestedSlots) {
  const savedByCol = new Map();
  for (const item of savedMappings ?? []) {
    const col = Number(item?.col);
    if (!Number.isFinite(col)) continue;
    savedByCol.set(col, item);
  }
  if (!Array.isArray(suggestedSlots) || !suggestedSlots.length) {
    return (savedMappings ?? [])
      .map((item) => ({
        col: Number(item.col),
        label: String(item.label ?? "").trim(),
        fieldKey: String(item.fieldKey ?? "").trim(),
      }))
      .filter((item) => Number.isFinite(item.col));
  }
  return suggestedSlots.map((slot) => {
    const saved = savedByCol.get(Number(slot.col));
    const fieldKey = String(saved?.fieldKey ?? slot.defaultFieldKey ?? "").trim();
    return {
      col: Number(slot.col),
      label: String(slot.label ?? saved?.label ?? "").trim(),
      fieldKey,
    };
  });
}

export function isIncompleteColumnSlotConfig(savedMappings, suggestedSlots) {
  if (!suggestedSlots?.length) return false;
  const savedCols = new Set(
    (savedMappings ?? []).map((item) => Number(item.col)).filter(Number.isFinite),
  );
  return suggestedSlots.some((slot) => !savedCols.has(Number(slot.col)));
}

export function getCategoryMeta(categoryKey) {
  const k = String(categoryKey ?? "").trim();
  return CHUNG_TU_CATEGORY_LIST.find((c) => c.key === k) ?? null;
}

export function assertKnownCategoryKey(categoryKey) {
  const meta = getCategoryMeta(categoryKey);
  if (!meta) {
    const err = new Error(`categoryKey không hợp lệ: ${categoryKey}`);
    err.code = "INVALID_CATEGORY";
    throw err;
  }
  return meta;
}
