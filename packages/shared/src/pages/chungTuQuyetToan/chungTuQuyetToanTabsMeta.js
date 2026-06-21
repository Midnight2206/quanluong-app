/**
 * Các «loại» chứng từ hiển thị dạng tab cấp 1 trên Chứng từ quyết toán.
 */

export const CHUNG_TU_DOC_TAB_STATUS = Object.freeze({
  AVAILABLE: "available",
  PLANNED: "planned",
});

/** @typedef {{ id: string, label: string, status: "available"|"planned", mode?: "by-date"|"by-slip", subtitle: string, hint?: string }} ChungTuDocTabMeta */

/** @type {ChungTuDocTabMeta[]} */
export const CHUNG_TU_QUYET_TOAN_DOCUMENT_TABS = [
  {
    id: "bang-ke-mua-hang",
    label: "Bảng kê mua hàng",
    status: CHUNG_TU_DOC_TAB_STATUS.AVAILABLE,
    mode: "by-date",
    subtitle:
      "Tổng hợp dòng LTTP theo ngày → Google Sheets (mẫu C34). Chọn kho, ngày, mẫu Drive rồi Tạo / Đồng bộ.",
  },
  {
    id: "phieu-xuat-kho",
    label: "Phiếu xuất kho",
    status: CHUNG_TU_DOC_TAB_STATUS.AVAILABLE,
    mode: "by-date",
    subtitle:
      "Tổng hợp LTTP theo tháng → Google Sheets (SS14-QN10). Chọn tháng, đơn vị và chế độ gộp dữ liệu.",
  },
  {
    id: "phieu-nhap-kho",
    label: "Phiếu nhập kho",
    status: CHUNG_TU_DOC_TAB_STATUS.AVAILABLE,
    mode: "by-date",
    subtitle:
      "Tổng hợp LTTP theo tháng → Google Sheets. Căn cứ BKMH tự điền từ snapshot đã đồng bộ.",
  },
  {
    id: "giay-de-nghi-thanh-toan",
    label: "Giấy đề nghị thanh toán",
    status: CHUNG_TU_DOC_TAB_STATUS.PLANNED,
    subtitle: "Đề nghị thanh toán / hoàn ứng / quyết toán tạm ứng theo đơn vị.",
    hint: "Có thể thiết kế mẫu trên Docs/Sheet và ghép vào luồng sau.",
  },
  {
    id: "phieu-thu-chi-quy",
    label: "Phiếu thu / chi quỹ",
    status: CHUNG_TU_DOC_TAB_STATUS.PLANNED,
    subtitle: "Phiếu thu tiền mặt, phiếu chi quỹ HT phục vụ quyết toán.",
  },
  {
    id: "bang-ke-chuyen-nhuong-ns",
    label: "Bảng kê chuyển nhượng",
    status: CHUNG_TU_DOC_TAB_STATUS.PLANNED,
    subtitle: "Bảng kê chứng từ chuyển nhượng vật tư, hàng hoá.",
  },
  {
    id: "bien-ban-kiem-ke",
    label: "Biên bản kiểm kê",
    status: CHUNG_TU_DOC_TAB_STATUS.PLANNED,
    subtitle: "Biên bản đối chiếu — số lượng, giá trị tại kỳ quyết toán.",
  },
];

export const DEFAULT_CHUNG_TU_DOC_TAB_ID =
  CHUNG_TU_QUYET_TOAN_DOCUMENT_TABS.find((t) => t.status === CHUNG_TU_DOC_TAB_STATUS.AVAILABLE)?.id ??
  CHUNG_TU_QUYET_TOAN_DOCUMENT_TABS[0]?.id ??
  "bang-ke-mua-hang";
