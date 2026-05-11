/**
 * Các «loại» chứng từ hiển thị dạng tab cấp 1 trên Chứng từ quyết toán.
 * Mở rộng: thêm entry + `{ id, label }` không trùng; `status: "available"` cần gắn panel trong page.
 */

export const CHUNG_TU_DOC_TAB_STATUS = Object.freeze({
  AVAILABLE: "available",
  PLANNED: "planned",
});

/** @typedef {{ id: string, label: string, status: "available"|"planned", subtitle: string, hint?: string }} ChungTuDocTabMeta */

/** @type {ChungTuDocTabMeta[]} */
export const CHUNG_TU_QUYET_TOAN_DOCUMENT_TABS = [
  {
    id: "bang-ke-mua-hang",
    label: "Bảng kê mua hàng",
    status: CHUNG_TU_DOC_TAB_STATUS.AVAILABLE,
    subtitle: "Theo mẫu ban hành — soạn nội dung nháp cục bộ, chọn file mẫu Google (nếu có trong danh mục).",
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
    id: "phieu-nhap-xuat-kho",
    label: "Phiếu nhập · xuất kho",
    status: CHUNG_TU_DOC_TAB_STATUS.PLANNED,
    subtitle: "Liên kết kho và chứng từ quyết toán chi phí đầu vào.",
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
