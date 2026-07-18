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

export function normalizeCommodityId(commodityId) {
  if (commodityId === "" || commodityId == null) {
    return null;
  }
  const cid = Number(commodityId);
  return Number.isInteger(cid) && cid > 0 ? cid : null;
}

export function alternateIssueSlipPriceKind(priceKind) {
  return normalizeIssueSlipPriceKind(priceKind) === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
    ? LTTP_ISSUE_SLIP_PRICE_KIND.MARKET
    : LTTP_ISSUE_SLIP_PRICE_KIND.TGSX;
}

/**
 * Khi chọn mặt hàng đã có ở dòng khác: gợi ý loại giá còn lại (TT ↔ TGSX).
 */
export function suggestPriceKindForDuplicateCommodity(
  rows,
  currentRowKey,
  commodityId,
  { tgsxAvailable = true } = {},
) {
  const cid = normalizeCommodityId(commodityId);
  if (cid == null) {
    return LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
  }
  const siblings = rows.filter(
    (r) =>
      r.key !== currentRowKey && normalizeCommodityId(r.commodityId) === cid,
  );
  if (siblings.length === 0) {
    return LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
  }
  if (siblings.length >= 2) {
    const used = new Set(
      siblings.map((s) => normalizeIssueSlipPriceKind(s.priceKind)),
    );
    if (!used.has(LTTP_ISSUE_SLIP_PRICE_KIND.MARKET)) {
      return LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
    }
    if (
      !used.has(LTTP_ISSUE_SLIP_PRICE_KIND.TGSX) &&
      tgsxAvailable
    ) {
      return LTTP_ISSUE_SLIP_PRICE_KIND.TGSX;
    }
    return LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
  }
  const suggested = alternateIssueSlipPriceKind(siblings[0].priceKind);
  if (
    suggested === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX &&
    !tgsxAvailable
  ) {
    return LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
  }
  return suggested;
}

/** Khóa dedupe một dòng phiếu: cùng mặt hàng + cùng loại giá (Mua TT / TGSX). */
export function issueSlipLineDedupeKey({ commodityId, priceKind }) {
  const cid = normalizeCommodityId(commodityId);
  if (cid == null) {
    return null;
  }
  return `${cid}:${normalizeIssueSlipPriceKind(priceKind)}`;
}

export function collectIssueSlipFormLineIssues(rows) {
  const lineKeyCounts = new Map();
  const commodityCounts = new Map();

  for (const r of rows) {
    const cid = normalizeCommodityId(r.commodityId);
    if (cid != null) {
      commodityCounts.set(cid, (commodityCounts.get(cid) ?? 0) + 1);
    }
    const lineKey = issueSlipLineDedupeKey(r);
    if (lineKey) {
      lineKeyCounts.set(lineKey, (lineKeyCounts.get(lineKey) ?? 0) + 1);
    }
  }

  const duplicateLineKeys = new Set();
  for (const [key, n] of lineKeyCounts) {
    if (n > 1) {
      duplicateLineKeys.add(key);
    }
  }

  const tripleCommodityIds = new Set();
  for (const [cid, n] of commodityCounts) {
    if (n >= 3) {
      tripleCommodityIds.add(cid);
    }
  }

  return { duplicateLineKeys, tripleCommodityIds };
}

/** @deprecated Dùng collectIssueSlipFormLineIssues */
export function collectDuplicateIssueSlipLineKeys(rows) {
  return collectIssueSlipFormLineIssues(rows).duplicateLineKeys;
}

export function isDuplicateIssueSlipLine(row, duplicateKeys) {
  const key = issueSlipLineDedupeKey(row);
  return key != null && duplicateKeys.has(key);
}

export function isIssueSlipLineInvalid(row, issues) {
  const cid = normalizeCommodityId(row.commodityId);
  if (cid != null && issues.tripleCommodityIds.has(cid)) {
    return true;
  }
  return isDuplicateIssueSlipLine(row, issues.duplicateLineKeys);
}

export function hasIssueSlipFormLineIssues(issues) {
  return (
    issues.duplicateLineKeys.size > 0 || issues.tripleCommodityIds.size > 0
  );
}

export const LTTP_ISSUE_SLIP_DUPLICATE_LINE_MESSAGE =
  "Trùng mặt hàng và loại giá (Mua TT/TGSX) trong phiếu";

export const LTTP_ISSUE_SLIP_TRIPLE_COMMODITY_MESSAGE =
  "Mỗi mặt hàng chỉ tối đa hai dòng (Mua TT và TGSX) trong phiếu";

export const LTTP_ISSUE_SLIP_LINE_ISSUES_BANNER =
  "Mỗi mặt hàng tối đa hai dòng (một Mua TT, một TGSX). Các dòng tô đỏ vi phạm quy tắc này.";
