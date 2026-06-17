import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";
import { normalizeMonthUnitIds, normalizePeriodMonth } from "./chung-tu-monthly-sheets.js";

export function buildChungTuDocumentKey({
  categoryKey,
  unitId,
  periodDate,
  periodMonth,
  issueSlipId,
  unitIds,
}) {
  const cat = String(categoryKey ?? "").trim();
  if (cat === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO) {
    const sid = Number(issueSlipId);
    if (!Number.isInteger(sid) || sid <= 0) {
      throw new Error("Phiếu xuất kho cần issueSlipId.");
    }
    return `${cat}:slip:${sid}`;
  }
  if (cat === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG && periodMonth) {
    const month = normalizePeriodMonth(periodMonth);
    const ids = normalizeMonthUnitIds(unitIds);
    if (!ids.length) {
      throw new Error("Bảng kê mua hàng theo tháng cần ít nhất một đơn vị.");
    }
    return `${cat}:m:${month}:units:${ids.join(",")}`;
  }
  const uid = Number(unitId);
  const d = String(periodDate ?? "").trim();
  if (!Number.isInteger(uid) || uid <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Chứng từ theo ngày cần unitId và periodDate (YYYY-MM-DD).");
  }
  return `${cat}:u:${uid}:d:${d}`;
}
