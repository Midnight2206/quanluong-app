/**
 * Vị trí / kích thước ảnh chữ ký trên PDF phiếu xuất LTTP.
 * Chỉnh tại ĐÂY — document-service nhận layout qua payload.
 *
 * fitToHeight=true: cao cố định heightPt; rộng theo tỉ lệ ảnh, tối đa widthPt (không kéo méo).
 */
export const LTTP_ISSUE_SLIP_SIGNATURE_IMAGE_LAYOUT = Object.freeze({
  /** Chiều cao hiển thị trên PDF (~34pt). */
  heightPt: 34,
  /** Chiều rộng tối đa (pt); thực tế = min(widthPt, heightPt * aspect). */
  widthPt: 120,
  /** Offset dọc từ đáy band chức danh xuống (pt). */
  offsetYFromTitlePt: 2,
  /** true = căn giữa cột. */
  centerHorizontally: true,
  /** Cố định chiều cao, giữ tỉ lệ ảnh. */
  fitToHeight: true,
});

/**
 * Nguồn ảnh cố định theo user trên phiếu.
 * nguoi_duyet: lấy từ settings.approverUserId khi useDigitalSignature=true (xem document.service).
 */
export const LTTP_ISSUE_SLIP_SIGNATURE_IMAGE_SLOT_SOURCES = Object.freeze({
  nguoi_viet_phieu: "exporting_user",
  nguoi_nhan: "recipient_user",
});
