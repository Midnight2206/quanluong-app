/**
 * Bản nháp số lượng thành dòng phiếu nhập của đơn vị (cột I/J).
 * Bỏ thì không ghi. Không ghi số vào ô sổ. Cột Trên BĐ không nhận bản nháp này.
 */

function isUnitSlipLine(line) {
  if (!line?.savable || !line.commodityId) return false;
  if (line.kind === "meal_out" || line.kind === "other_out") return false;
  if (line.source === "G" || line.source === "H") return false;
  return line.source === "J" || line.source === "I" || line.kind === "self_supply" || line.kind === "rice";
}

function reviewDraft(action, lines) {
  if (action !== "accept") return { save: false, slipLines: [] };
  const slipLines = (lines || []).filter(isUnitSlipLine).map((line) => ({
    ...line,
    priceKind: line.source === "J" ? "tgsx" : "market",
  }));
  return { save: slipLines.length > 0, slipLines };
}

export { reviewDraft, isUnitSlipLine };
