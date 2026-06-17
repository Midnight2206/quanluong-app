/**
 * Danh mục gợi ý fieldKey + nguồn dữ liệu (form / DB) để superadmin thiết kế fillRules.
 * Mở rộng từng category khi có thêm chứng từ / resolver backend.
 */

const REGISTRY_BY_CATEGORY = Object.freeze({
  "bang-ke-mua-hang": Object.freeze({
    categoryKey: "bang-ke-mua-hang",
    label: "Bảng kê mua hàng",
    formFields: [
      { fieldKey: "donViCapTren", label: "Đơn vị cấp trên", source: "form" },
      { fieldKey: "donViCapMinh", label: "Đơn vị cấp mình", source: "form", note: "Alias của donViSo" },
      { fieldKey: "donViSo", label: "Đơn vị cấp mình (donViSo)", source: "form" },
      { fieldKey: "boPhan", label: "Bộ phận", source: "form" },
      { fieldKey: "ngay", label: "Ngày (dd)", source: "derived" },
      { fieldKey: "thang", label: "Tháng (mm)", source: "derived" },
      { fieldKey: "nam", label: "Năm (yyyy)", source: "derived" },
      { fieldKey: "ngayThangNam", label: "Ngày tháng năm", source: "derived" },
      { fieldKey: "so", label: "Số", source: "derived" },
      { fieldKey: "soChungTu", label: "Số chứng từ", source: "derived" },
      { fieldKey: "quyenSo", label: "Quyển số", source: "derived" },
      { fieldKey: "nguoiMua", label: "Người mua (chữ ký)", source: "form" },
      { fieldKey: "phuTrachBoPhan", label: "Phụ trách bộ phận (chữ ký)", source: "form" },
      { fieldKey: "taiChinh", label: "Tài chính (chữ ký)", source: "form" },
      { fieldKey: "thuTruongDonVi", label: "Thủ trưởng đơn vị (chữ ký)", source: "form" },
      { fieldKey: "tongTienBangChu", label: "Tổng tiền bằng chữ", source: "derived" },
    ],
    dbTables: [
      {
        dbTable: "lttp_issue_slip_lines",
        label: "Dòng chi tiết theo ngày",
        columns: [
          { column: "stt", fieldKeyHint: "stt", source: "row_index" },
          { column: "tenHang", fieldKeyHint: "tenHang", source: "db" },
          { column: "dvt", fieldKeyHint: "dvt", source: "db" },
          { column: "nguoiBan", fieldKeyHint: "nguoiBan", source: "db" },
          { column: "soLuong", fieldKeyHint: "soLuong", source: "db" },
          { column: "donGia", fieldKeyHint: "donGia", source: "db" },
          { column: "thanhTien", fieldKeyHint: "thanhTien", source: "derived" },
        ],
      },
    ],
  }),
  "phieu-xuat-kho": Object.freeze({
    categoryKey: "phieu-xuat-kho",
    label: "Phiếu xuất kho",
    formFields: [
      { fieldKey: "donViSo", label: "Đơn vị / dòng in 1", source: "form" },
      { fieldKey: "printLine2", label: "Dòng in 2", source: "form" },
      { fieldKey: "mauSo", label: "Mẫu số", source: "form" },
      { fieldKey: "quyenSo", label: "Quyển số (MMYY)", source: "form" },
      { fieldKey: "soChungTu", label: "Số phiếu", source: "form" },
      { fieldKey: "warehouseFrom", label: "Xuất tại kho", source: "form" },
      { fieldKey: "recipientDisplayName", label: "Người nhận", source: "db" },
      { fieldKey: "tongTienBangChu", label: "Tổng tiền bằng chữ", source: "derived" },
      { fieldKey: "signerWriter", label: "Người lập", source: "form" },
      { fieldKey: "signerApprover", label: "Thủ trưởng đơn vị", source: "form" },
      { fieldKey: "signerRecipient", label: "Người nhận (chữ ký)", source: "db" },
    ],
    dbTables: [
      {
        dbTable: "lttp_issue_slip_lines",
        label: "Dòng phiếu xuất",
        columns: [
          { column: "stt", fieldKeyHint: "stt", source: "row_index" },
          { column: "tenHang", fieldKeyHint: "tenHang", source: "db" },
          { column: "maSo", fieldKeyHint: "maSo", source: "db" },
          { column: "dvt", fieldKeyHint: "dvt", source: "db" },
          { column: "soLuong", fieldKeyHint: "soLuong", source: "db" },
          { column: "donGia", fieldKeyHint: "donGia", source: "db" },
          { column: "thanhTien", fieldKeyHint: "thanhTien", source: "derived" },
        ],
      },
    ],
  }),
  "phieu-nhap-kho": Object.freeze({
    categoryKey: "phieu-nhap-kho",
    label: "Phiếu nhập kho",
    formFields: [
      { fieldKey: "donViCapTren", label: "Đơn vị cấp trên", source: "form" },
      { fieldKey: "donViSo", label: "Đơn vị soạn", source: "form" },
      { fieldKey: "mauSo", label: "Mẫu số", source: "form" },
      { fieldKey: "quyenSo", label: "Quyển số", source: "form" },
      { fieldKey: "hoTenNguoiMua", label: "Người giao / mua", source: "form" },
      { fieldKey: "tongTienBangChu", label: "Tổng tiền bằng chữ", source: "derived" },
    ],
    dbTables: [
      {
        dbTable: "lttp_issue_slip_lines",
        label: "Dòng tổng hợp theo ngày",
        columns: [
          { column: "stt", fieldKeyHint: "stt", source: "row_index" },
          { column: "tenHang", fieldKeyHint: "tenHang", source: "db" },
          { column: "dvt", fieldKeyHint: "dvt", source: "db" },
          { column: "nguoiBan", fieldKeyHint: "nguoiBan", source: "db" },
          { column: "soLuong", fieldKeyHint: "soLuong", source: "db" },
          { column: "donGia", fieldKeyHint: "donGia", source: "db" },
          { column: "thanhTien", fieldKeyHint: "thanhTien", source: "derived" },
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
