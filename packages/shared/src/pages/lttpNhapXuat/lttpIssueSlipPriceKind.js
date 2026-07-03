export const LTTP_ISSUE_SLIP_PRICE_KIND = Object.freeze({
  MARKET: "market",
  TGSX: "tgsx",
});

export function normalizeIssueSlipPriceKind(value) {
  return String(value ?? "").trim().toLowerCase() === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
    ? LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
    : LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
}

export function issueSlipPriceKindLabel(kind) {
  return normalizeIssueSlipPriceKind(kind) === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
    ? "TGSX"
    : "Mua TT";
}

/** Đơn giá áp dụng theo loại đã chọn (snapshot từ bảng giá). */
export function resolveIssueSlipAppliedUnitPrice({ priceKind, unitPrice, tgsxPrice }) {
  if (normalizeIssueSlipPriceKind(priceKind) === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX) {
    const tgsx = Number(tgsxPrice);
    return Number.isFinite(tgsx) ? tgsx : null;
  }
  const market = Number(unitPrice);
  return Number.isFinite(market) ? market : null;
}
