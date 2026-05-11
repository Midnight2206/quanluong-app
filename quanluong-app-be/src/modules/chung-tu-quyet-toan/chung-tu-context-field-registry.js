/**
 * Danh mục gợi ý fieldKey + nguồn dữ liệu (form / DB) để superadmin thiết kế fillRules.
 * Mở rộng từng category khi có thêm chứng từ / resolver backend.
 */

const REGISTRY_BY_CATEGORY = Object.freeze({
  "bang-ke-mua-hang": Object.freeze({
    categoryKey: "bang-ke-mua-hang",
    label: "Bảng kê mua hàng",
    formFields: [
      { fieldKey: "donViCapTren", label: "Đơn vị cấp trên", source: "form", note: "Ví dụ: Sư đoàn …" },
      { fieldKey: "donViSo", label: "Đơn vị soạn", source: "form", note: "" },
      { fieldKey: "mauSo", label: "Mẫu số", source: "form", note: "" },
      { fieldKey: "quyenSo", label: "Quyển số", source: "form", note: "" },
      { fieldKey: "soChungTu", label: "Số chứng từ", source: "form", note: "" },
      { fieldKey: "hoTenNguoiMua", label: "Họ tên người mua hàng", source: "form", note: "" },
      { fieldKey: "boPhan", label: "Bộ phận", source: "form", note: "" },
      { fieldKey: "noTaiKhoan", label: "Nợ có / tài khoản (chữ hiển thị)", source: "form", note: "" },
      { fieldKey: "coTaiKhoan", label: "Có …", source: "form", note: "" },
      { fieldKey: "tongTienBangChu", label: "Tổng tiền bằng chữ", source: "form", note: "" },
      { fieldKey: "ghiChu", label: "Ghi chú", source: "form", note: "" },
    ],
    dbTables: [
      {
        dbTable: "lttp_issue_slip_lines",
        label: "Dòng chi tiết phiếu xuất (gợi ý resolver)",
        description:
          "Dùng trong docs.regions[].tableSource.dbTable và columns[].fieldKey để đổ khối bảng vào Docs (khi Apps Script / resolver hỗ trợ).",
        columns: [
          { column: "stt", fieldKeyHint: "line_stt", source: "row_index" },
          { column: "tenHang", fieldKeyHint: "commodity_name", source: "db" },
          { column: "dvt", fieldKeyHint: "unit_label", source: "db" },
          { column: "soLuong", fieldKeyHint: "qty", source: "db" },
          { column: "donGia", fieldKeyHint: "unit_price", source: "db" },
          { column: "thanhTien", fieldKeyHint: "line_total", source: "derived" },
        ],
      },
    ],
  }),
});

function normalizeCategoryKey(categoryKey) {
  const k = String(categoryKey ?? "").trim();
  return k || "";
}

/** Trả registry cho category hoặc cấu trúc trống. */
export function getContextFieldRegistryForCategory(categoryKey) {
  const k = normalizeCategoryKey(categoryKey);
  if (!k) {
    return {
      categoryKey: null,
      label: null,
      formFields: [],
      dbTables: [],
    };
  }
  const entry = REGISTRY_BY_CATEGORY[k];
  if (!entry) {
    return {
      categoryKey: k,
      label: null,
      formFields: [],
      dbTables: [],
      unknownCategory: true,
    };
  }
  return {
    categoryKey: entry.categoryKey,
    label: entry.label,
    formFields: [...entry.formFields],
    dbTables: entry.dbTables.map((t) => ({
      ...t,
      columns: [...t.columns],
    })),
  };
}

export function listRegisteredCategoryKeys() {
  return Object.keys(REGISTRY_BY_CATEGORY);
}
