import {
  CHUNG_TU_CATEGORY_KEYS,
  normalizeAggregationMode,
} from "./chung-tu-category.constants.js";
import { normalizeMonthUnitIds, normalizePeriodMonth } from "./chung-tu-monthly-sheets.js";

export function buildChungTuDocumentKey({
  categoryKey,
  unitId,
  periodDate,
  periodMonth,
  issueSlipId,
  unitIds,
  aggregationMode,
  templateDriveFileId,
}) {
  const cat = String(categoryKey ?? "").trim();
  if (cat === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO && issueSlipId && !periodMonth) {
    const sid = Number(issueSlipId);
    if (!Number.isInteger(sid) || sid <= 0) {
      throw new Error("Phiếu xuất kho cần issueSlipId.");
    }
    return `${cat}:slip:${sid}`;
  }
  if (cat === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG && periodMonth) {
    const month = normalizePeriodMonth(periodMonth);
    const ids = normalizeMonthUnitIds(unitIds);
    const uid = Number(unitId);
    if (!ids.length) {
      throw new Error("Bảng kê mua hàng theo tháng cần ít nhất một đơn vị.");
    }
    if (!Number.isInteger(uid) || uid <= 0) {
      throw new Error("Bảng kê mua hàng cần unitId kho LTTP.");
    }
    return `${cat}:m:${month}:u:${uid}:units:${ids.join(",")}`;
  }
  if (cat === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO && periodMonth) {
    const month = normalizePeriodMonth(periodMonth);
    const ids = normalizeMonthUnitIds(unitIds);
    const uid = Number(unitId);
    if (!ids.length) {
      throw new Error("Phiếu nhập kho theo tháng cần ít nhất một đơn vị.");
    }
    if (!Number.isInteger(uid) || uid <= 0) {
      throw new Error("Phiếu nhập kho cần unitId kho LTTP.");
    }
    return `${cat}:m:${month}:u:${uid}:units:${ids.join(",")}`;
  }
  if (cat === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO && periodMonth) {
    const month = normalizePeriodMonth(periodMonth);
    const ids = normalizeMonthUnitIds(unitIds);
    const uid = Number(unitId);
    if (!ids.length) {
      throw new Error("Phiếu xuất kho theo tháng cần ít nhất một đơn vị.");
    }
    if (!Number.isInteger(uid) || uid <= 0) {
      throw new Error("Phiếu xuất kho cần unitId kho LTTP.");
    }
    return `${cat}:m:${month}:u:${uid}:units:${ids.join(",")}`;
  }
  if (periodMonth && templateDriveFileId) {
    const month = normalizePeriodMonth(periodMonth);
    const ids = normalizeMonthUnitIds(unitIds);
    if (!ids.length) {
      throw new Error("Chứng từ theo tháng cần ít nhất một đơn vị.");
    }
    const mode = normalizeAggregationMode(aggregationMode);
    const tpl = String(templateDriveFileId ?? "").trim();
    return `${cat}:m:${month}:agg:${mode}:units:${ids.join(",")}:tpl:${tpl}`;
  }
  const uid = Number(unitId);
  const d = String(periodDate ?? "").trim();
  if (!Number.isInteger(uid) || uid <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Chứng từ theo ngày cần unitId và periodDate (YYYY-MM-DD).");
  }
  return `${cat}:u:${uid}:d:${d}`;
}
