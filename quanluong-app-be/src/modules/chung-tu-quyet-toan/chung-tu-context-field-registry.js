/**
 * Field app tự fill — chỉ số, ngày tháng năm, tổng tiền bằng chữ.
 * Các field khác (đơn vị, chữ ký, …) user khai báo cố định trên template.
 */

const REGISTRY_BY_CATEGORY = Object.freeze({
  "bang-ke-mua-hang": Object.freeze({
    categoryKey: "bang-ke-mua-hang",
    label: "Bảng kê mua hàng",
    formFields: [],
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
    formFields: [],
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
          { column: "ghiChu", fieldKeyHint: "ghiChu", source: "db" },
        ],
      },
    ],
  }),
  "phieu-nhap-kho": Object.freeze({
    categoryKey: "phieu-nhap-kho",
    label: "Phiếu nhập kho",
    formFields: [],
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
