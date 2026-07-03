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

/** Số lượng hiển thị ở cột Mua TT / TGSX (theo loại giá đang chọn). */
export function resolveIssueSlipDisplayQuantities({ priceKind, quantity }) {
  const kind = normalizeIssueSlipPriceKind(priceKind);
  const raw =
    quantity !== "" && quantity != null && String(quantity).trim() !== ""
      ? quantity
      : null;
  if (raw == null) {
    return { quantityMarket: null, quantityTgsx: null };
  }
  if (kind === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX) {
    return { quantityMarket: null, quantityTgsx: raw };
  }
  return { quantityMarket: raw, quantityTgsx: null };
}

/** Ô chỉ đọc trên form: hiển thị SL đang nhập nếu khớp loại giá. */
export function issueSlipQuantityDisplayCell({ priceKind, quantity, targetKind }) {
  const kind = normalizeIssueSlipPriceKind(priceKind);
  const target = normalizeIssueSlipPriceKind(targetKind);
  const qtyStr =
    quantity !== "" && quantity != null && String(quantity).trim() !== ""
      ? String(quantity)
      : "";
  if (!qtyStr || kind !== target) {
    return "—";
  }
  return qtyStr;
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
