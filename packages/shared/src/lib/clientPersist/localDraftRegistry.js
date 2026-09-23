/**
 * In-memory registry of forms that only exist as local IDB drafts
 * (not yet saved to the server). UI subscribes for the status bar.
 */

/** @typedef {{ id: string; label: string; draftType: string; updatedAt: string }} LocalDraftEntry */

/** @type {Map<string, LocalDraftEntry>} */
const entries = new Map();

/** @type {Set<() => void>} */
const listeners = new Set();

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

/** @param {string} draftType */
export function defaultLabelForDraftType(draftType) {
  /** @type {Record<string, string>} */
  const map = {
    "issue-slip": "Phiếu xuất LTTP",
    "lich-su-filters": "Bộ lọc lịch sử xuất kho",
    "ordering-filters": "Đặt hàng LTTP",
    "issue-slip-signature": "Cài đặt chữ ký phiếu xuất",
    "kitchen-shell": "Sổ sách bếp (ngày / đơn vị)",
    "kitchen-receipt": "Phiếu nhập kho bếp",
    "kitchen-menu": "Thực đơn bếp",
    "meal-roster-shell": "Chấm cơm (tháng / đơn vị)",
    "meal-roster-guaranty": "Danh sách bảo đảm",
    "meal-roster-ledger": "Sổ chấm cơm",
    "chungtu-export": "Xuất chứng từ",
    "chungtu-summary": "Tóm tắt chứng từ",
    "chungtu-history": "Lịch sử chứng từ",
    "chungtu-signature": "Cài đặt chữ ký chứng từ",
    "chungtu-field-catalog": "Tra cứu field chứng từ",
    "shared-manual-unit": "Đơn vị kho đang chọn",
    "admin-job-titles": "Chức danh (nháp)",
    "admin-lttp": "Quản trị LTTP (nháp)",
    "sa-perm-matrix": "Ma trận quyền",
    "sa-meal-rates": "Mức tiền ăn",
    "sa-users-create": "Tạo người dùng",
    "sa-units-create": "Tạo đơn vị",
    "sa-perm-desc": "Mô tả quyền",
    "sa-ct-pdf-templates": "Mẫu PDF chứng từ",
    "reject-notes": "Ghi chú từ chối đăng ký",
    "profile-edit": "Hồ sơ cá nhân",
  };
  return map[draftType] ?? draftType;
}

/**
 * @param {string} id
 * @param {{ label?: string; draftType: string }} meta
 */
export function upsertLocalDraftEntry(id, meta) {
  const label = meta.label || defaultLabelForDraftType(meta.draftType);
  const prev = entries.get(id);
  entries.set(id, {
    id,
    label,
    draftType: meta.draftType,
    updatedAt: new Date().toISOString(),
  });
  if (!prev || prev.label !== label) {
    emit();
  } else {
    emit();
  }
}

/** @param {string} id */
export function removeLocalDraftEntry(id) {
  if (!entries.has(id)) {
    return;
  }
  entries.delete(id);
  emit();
}

/** @returns {LocalDraftEntry[]} */
export function listLocalDraftEntries() {
  return [...entries.values()].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
}

/** @param {() => void} fn */
export function subscribeLocalDraftEntries(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearLocalDraftRegistry() {
  if (entries.size === 0) {
    return;
  }
  entries.clear();
  emit();
}
