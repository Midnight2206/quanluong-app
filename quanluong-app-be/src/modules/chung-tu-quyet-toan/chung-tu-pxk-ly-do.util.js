import { CHUNG_TU_AGGREGATION_MODES } from "./chung-tu-category.constants.js";

function pad2(value) {
  return String(Number(value)).padStart(2, "0");
}

/**
 * @param {{ aggregationMode?: string, periodMonth?: string, periodDate?: string }} params
 * @returns {string}
 */
export function formatLyDoXuatKho({ aggregationMode, periodMonth, periodDate } = {}) {
  const mode = String(aggregationMode ?? "").trim();
  if (mode === CHUNG_TU_AGGREGATION_MODES.BY_DAY) {
    const [year, month, day] = String(periodDate ?? "").trim().split("-");
    return `Cấp tiếp phẩm ngày ${pad2(day)} tháng ${pad2(month)} năm ${year ?? ""}`.trim();
  }
  const [year, month] = String(periodMonth ?? "").trim().split("-");
  return `Cấp tiếp phẩm tháng ${pad2(month)} năm ${year ?? ""}`.trim();
}
