const SHARED_UNITS = new Set(["gói", "goi", "hộp", "hop", "cây", "cay"]);

function normalizeMeasureUnit(u) {
  return String(u ?? "")
    .trim()
    .toLowerCase();
}

function classifyCommodityCalcMode(measureUnit) {
  return SHARED_UNITS.has(normalizeMeasureUnit(measureUnit))
    ? "per_unit_shared"
    : "per_person";
}

function computeLineTotalQuantity(input) {
  const hc = Math.max(0, Number(input.headcount) || 0);
  if (input.calcMode === "per_unit_shared") {
    const ppu = Number(input.peoplePerUnit);
    if (!Number.isFinite(ppu) || ppu <= 0) {
      return { totalQuantity: 0, totalUnit: input.commodityMeasureUnit ?? "—" };
    }
    return {
      totalQuantity: hc === 0 ? 0 : Math.ceil(hc / ppu),
      totalUnit: input.commodityMeasureUnit ?? "—",
    };
  }
  const amt = Number(input.perPersonAmount);
  const unit = input.perPersonUnit === "ml" ? "ml" : "g";
  if (!Number.isFinite(amt) || amt <= 0 || hc === 0) {
    return { totalQuantity: 0, totalUnit: unit === "ml" ? "L" : "kg" };
  }
  const raw = (amt * hc) / 1000;
  return {
    totalQuantity: Math.round(raw * 10000) / 10000,
    totalUnit: unit === "ml" ? "L" : "kg",
  };
}

export {
  SHARED_UNITS,
  normalizeMeasureUnit,
  classifyCommodityCalcMode,
  computeLineTotalQuantity,
};
