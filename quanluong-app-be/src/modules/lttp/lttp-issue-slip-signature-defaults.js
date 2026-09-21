/** Default signature block for LTTP phiếu xuất (4 slots). */

export const LTTP_ISSUE_SLIP_SIGNATURE_SLOT_KEYS = Object.freeze([
  "nguoi_viet_phieu",
  "thu_kho",
  "nguoi_nhan",
  "nguoi_duyet",
]);

/** Slot cố định: tên lúc in lấy từ user đang làm việc / người nhận phiếu — không sửa trong settings. */
export const LTTP_ISSUE_SLIP_LOCKED_SIGNATURE_SLOT_KEYS = Object.freeze([
  "nguoi_viet_phieu",
  "nguoi_nhan",
]);

function slot(key, label, col, { locked = false } = {}) {
  return {
    key,
    label,
    col,
    col_span: 1,
    source: "dynamic",
    static_name: "",
    catalogNodeId: "",
    locked,
    show_date_line: false,
  };
}

/**
 * @returns {{ columns: number, gap_pt: number, date_line_gap_pt: number, slots: object[] }}
 */
export function getDefaultLttpIssueSlipSignatureBlock() {
  return {
    columns: 4,
    // Cùng khoảng title→tên với CTQT (document-service: name_y = title - gap_pt).
    gap_pt: 40,
    date_line_gap_pt: 4,
    slots: [
      slot("nguoi_viet_phieu", "NGƯỜI VIẾT PHIẾU", 0, { locked: true }),
      slot("thu_kho", "THỦ KHO", 1),
      slot("nguoi_nhan", "NGƯỜI NHẬN", 2, { locked: true }),
      slot("nguoi_duyet", "NGƯỜI DUYỆT", 3),
    ],
  };
}

export function normalizeLttpIssueSlipExtraFields(input) {
  return {
    lyDoSuDung: String(input?.lyDoSuDung ?? "").trim(),
    nhanTaiKho: String(input?.nhanTaiKho ?? "").trim(),
  };
}

export function normalizeLttpIssueSlipSignatureBlock(input) {
  const fallback = getDefaultLttpIssueSlipSignatureBlock();
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fallback;
  }
  const slotsIn = Array.isArray(input.slots) ? input.slots : [];
  const lockedKeys = new Set(LTTP_ISSUE_SLIP_LOCKED_SIGNATURE_SLOT_KEYS);
  const slots =
    slotsIn.length > 0
      ? slotsIn.map((s, index) => {
          const key = String(s?.key ?? "").trim() || `slot_${index}`;
          const isLocked = lockedKeys.has(key) || Boolean(s?.locked);
          const source = isLocked
            ? "dynamic"
            : s?.source === "static" || s?.source === "system"
              ? s.source
              : "dynamic";
          return {
            key,
            label: String(s?.label ?? "").trim(),
            col: Number.isFinite(Number(s?.col)) ? Number(s.col) : index,
            col_span: Number.isFinite(Number(s?.col_span)) ? Number(s.col_span) : 1,
            source,
            static_name:
              !isLocked && source === "static" ? String(s?.static_name ?? "").trim() : "",
            catalogNodeId:
              !isLocked && source === "system" ? String(s?.catalogNodeId ?? "").trim() : "",
            show_date_line: Boolean(s?.show_date_line),
            locked: isLocked,
          };
        })
      : fallback.slots;
  return {
    columns: Number.isFinite(Number(input.columns)) ? Number(input.columns) : fallback.columns,
    // ponytail: default cũ gap_pt=8 gần như không chừa chỗ ký; <20 → nâng về CTQT 40.
    gap_pt: (() => {
      const raw = Number(input.gap_pt);
      if (!Number.isFinite(raw) || raw < 20) return fallback.gap_pt;
      return raw;
    })(),
    date_line_gap_pt: Number.isFinite(Number(input.date_line_gap_pt))
      ? Number(input.date_line_gap_pt)
      : fallback.date_line_gap_pt,
    slots,
  };
}
