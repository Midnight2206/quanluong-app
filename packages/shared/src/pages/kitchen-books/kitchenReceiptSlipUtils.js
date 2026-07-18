import {
  LTTP_ISSUE_SLIP_PRICE_KIND,
  normalizeIssueSlipPriceKind,
  resolveIssueSlipAppliedUnitPrice,
} from "@/pages/lttpNhapXuat/lttpIssueSlipPriceKind";

export function newReceiptSlipEmptyRow(priceKind = LTTP_ISSUE_SLIP_PRICE_KIND.MARKET) {
  return {
    key: `r${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    commodityId: "",
    codeDraft: "",
    quantity: "1",
    unitPrice: null,
    tgsxPrice: null,
    priceKind: normalizeIssueSlipPriceKind(priceKind),
    guaranteeAppliedPrice: null,
    lineNote: "",
  };
}

/** Dòng tab Mua TT / TGSX: data đúng loại giá + tối đa một dòng trống. */
export function visibleRowsForPriceKind(rows, kind) {
  const k = normalizeIssueSlipPriceKind(kind);
  const list = rows ?? [];
  const data = list.filter(
    (r) => r.commodityId && normalizeIssueSlipPriceKind(r.priceKind) === k,
  );
  const emptySame = list.find(
    (r) => !r.commodityId && normalizeIssueSlipPriceKind(r.priceKind) === k,
  );
  if (emptySame) {
    return [...data, emptySame];
  }
  const anyEmpty = list.find((r) => !r.commodityId);
  if (anyEmpty) {
    return [...data, anyEmpty];
  }
  return data;
}

export const RECEIPT_LINE_SOURCE = {
  ON_GUARANTEE: "on_guarantee",
  UNIT_SELF: "unit_self",
};

function appliedPriceFromSlipLine(line) {
  const kind = normalizeIssueSlipPriceKind(line.priceKind);
  if (kind === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX && line.tgsxPrice != null) {
    return Number(line.tgsxPrice);
  }
  return line.unitPrice != null ? Number(line.unitPrice) : null;
}

/**
 * Tổng hợp (chỉ đọc) từ lines phiếu ngày đã lưu:
 * on_guarantee → Trên BĐ; unit_self → Đơn vị BĐ; gom cùng mặt hàng + cùng đơn giá.
 */
export function buildTongHopDisplayRowsFromSlipLines(lines) {
  /** @type {Map<string, object>} */
  const buckets = new Map();

  function ensure(commodityId, commodityCode, appliedPrice) {
    const price = roundMoney2(appliedPrice);
    const key = `${commodityId}:${price}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        key: `th_${key}`,
        commodityId,
        commodityCode: commodityCode ?? "",
        appliedPrice: price,
        trenBdMarket: 0,
        trenBdTgsx: 0,
        donViMarket: 0,
        donViTgsx: 0,
      };
      buckets.set(key, b);
    } else if (!b.commodityCode && commodityCode) {
      b.commodityCode = commodityCode;
    }
    return b;
  }

  for (const line of lines ?? []) {
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }
    const applied = appliedPriceFromSlipLine(line);
    if (applied == null || !Number.isFinite(applied)) {
      continue;
    }
    const code = line.commodity?.code ?? line.codeDraft ?? "";
    const b = ensure(line.commodityId, code, applied);
    const kind = normalizeIssueSlipPriceKind(line.priceKind);
    const isGuarantee = line.lineSource === RECEIPT_LINE_SOURCE.ON_GUARANTEE;
    if (isGuarantee) {
      if (kind === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX) b.trenBdTgsx += qty;
      else b.trenBdMarket += qty;
    } else if (kind === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX) {
      b.donViTgsx += qty;
    } else {
      b.donViMarket += qty;
    }
  }

  return [...buckets.values()].map((b) => {
    const qtySum = b.trenBdMarket + b.trenBdTgsx + b.donViMarket + b.donViTgsx;
    return {
      ...b,
      unitPrice: b.appliedPrice,
      amount: roundMoney2(qtySum * b.appliedPrice),
    };
  });
}

/** @deprecated dùng buildTongHopDisplayRowsFromSlipLines */
export function buildTongHopDisplayRows(rows, guaranteeItems) {
  const asLines = [];
  for (const item of guaranteeItems ?? []) {
    asLines.push({
      commodityId: item.commodityId,
      commodity: { code: item.commodityCode },
      quantity: item.quantity,
      priceKind: item.priceKind,
      unitPrice: item.appliedPrice,
      tgsxPrice:
        normalizeIssueSlipPriceKind(item.priceKind) === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
          ? item.appliedPrice
          : null,
      lineSource: RECEIPT_LINE_SOURCE.ON_GUARANTEE,
    });
  }
  for (const r of rows ?? []) {
    if (!r.commodityId) continue;
    asLines.push({
      ...r,
      lineSource: RECEIPT_LINE_SOURCE.UNIT_SELF,
      commodity: { code: r.codeDraft },
    });
  }
  return buildTongHopDisplayRowsFromSlipLines(asLines);
}

export function normalizeDecimalInputString(v) {
  if (v == null) {
    return "";
  }
  return String(v).replace(/\s/g, "").replace(/,/g, ".");
}

export function parsePositiveDecimalField(q) {
  if (q === "" || q == null) {
    return Number.NaN;
  }
  const s = normalizeDecimalInputString(q);
  if (s === "" || s === ".") {
    return Number.NaN;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function quantityInputDisplay(q) {
  if (q === "" || q == null) {
    return "";
  }
  return String(q);
}

export function isReceiptSlipRowComplete(r) {
  if (!r.commodityId) {
    return false;
  }
  if (resolveIssueSlipAppliedUnitPrice(r) == null) {
    return false;
  }
  const q = parsePositiveDecimalField(r.quantity);
  return Number.isFinite(q) && q > 0;
}

export function rowFromReceiptSlipLine(line) {
  const rand = Math.random().toString(36).slice(2, 7);
  return {
    key: `e${line.id}_${rand}`,
    commodityId: line.commodityId,
    codeDraft: line.commodity?.code ?? "",
    quantity: line.quantity != null ? String(line.quantity) : "",
    unitPrice: line.unitPrice ?? null,
    tgsxPrice: line.tgsxPrice ?? null,
    priceKind: normalizeIssueSlipPriceKind(line.priceKind),
    lineNote: typeof line?.lineNote === "string" ? line.lineNote : "",
  };
}

export function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function bookMmyyFromYmd(ymd) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return "----";
  }
  const yy = String(Number(m[1]) % 100).padStart(2, "0");
  return `${m[2]}${yy}`;
}

export function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return 0;
  }
  return Math.round(x * 100) / 100;
}

/** Khóa gom SL Trên BĐ: commodityId + loại giá + đơn giá áp dụng (khớp phiếu xuất LTTP). */
export function receiptSlipGuaranteeLookupKey(row, targetKind) {
  if (!row?.commodityId) {
    return null;
  }
  const kind = normalizeIssueSlipPriceKind(targetKind);
  const applied =
    kind === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
      ? row.tgsxPrice != null
        ? Number(row.tgsxPrice)
        : null
      : row.unitPrice != null
        ? Number(row.unitPrice)
        : null;
  if (applied == null || !Number.isFinite(applied)) {
    return null;
  }
  return `${row.commodityId}:${kind}:${roundMoney2(applied)}`;
}

export function formatGuaranteeQtyDisplay(qty) {
  if (qty == null || qty === "") {
    return "—";
  }
  const x = Number(qty);
  if (!Number.isFinite(x) || x <= 0) {
    return "—";
  }
  const s = x.toFixed(4).replace(/\.?0+$/, "");
  return s || "0";
}

export function resolveOnGuaranteeQty(row, targetKind, items) {
  if (!row?.commodityId || !Array.isArray(items) || !items.length) {
    return "—";
  }
  const kind = normalizeIssueSlipPriceKind(targetKind);
  let matches = items.filter(
    (i) =>
      i.commodityId === row.commodityId &&
      normalizeIssueSlipPriceKind(i.priceKind) === kind,
  );
  if (!matches.length) {
    return "—";
  }

  if (row.guaranteeAppliedPrice != null) {
    const p = roundMoney2(row.guaranteeAppliedPrice);
    matches = matches.filter((i) => roundMoney2(i.appliedPrice) === p);
  } else {
    const rowApplied =
      kind === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
        ? row.tgsxPrice != null
          ? Number(row.tgsxPrice)
          : null
        : row.unitPrice != null
          ? Number(row.unitPrice)
          : null;
    if (rowApplied != null && Number.isFinite(rowApplied)) {
      const exact = matches.filter((i) => roundMoney2(i.appliedPrice) === roundMoney2(rowApplied));
      if (exact.length) {
        matches = exact;
      }
    }
  }

  if (!matches.length) {
    return "—";
  }
  const total = matches.reduce((s, i) => s + Number(i.quantity), 0);
  return formatGuaranteeQtyDisplay(total);
}

