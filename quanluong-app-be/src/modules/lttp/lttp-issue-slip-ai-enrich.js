import { mapCommodityNameToId } from "../kitchen-books/kitchen-books-menu-ai-map.js";
import { LTTP_ISSUE_SLIP_PRICE_KIND } from "./lttp.constants.js";

function trimOrNull(value) {
  const s = String(value ?? "").trim();
  return s || null;
}

function intOrNull(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function quantityOrNull(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** @returns {'market' | 'tgsx' | null} */
function normalizeEnrichPriceKind(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) {
    return null;
  }
  if (v === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX) {
    return LTTP_ISSUE_SLIP_PRICE_KIND.TGSX;
  }
  if (v === LTTP_ISSUE_SLIP_PRICE_KIND.MARKET) {
    return LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
  }
  return null;
}

function issueSlipLineDedupeKey(commodityId, priceKind) {
  const cid = Number(commodityId);
  if (!Number.isInteger(cid) || cid <= 0 || !priceKind) {
    return null;
  }
  return `${cid}:${priceKind}`;
}

function buildHeaderDraft(header) {
  const h = header && typeof header === "object" ? header : {};
  return {
    issueDate: trimOrNull(h.issueDate),
    receivedDate: trimOrNull(h.receivedDate),
    recipientUnitId: intOrNull(h.recipientUnitId),
    recipientUserId: intOrNull(h.recipientUserId),
    recipientDisplayName: trimOrNull(h.recipientDisplayName),
    buyerUserId: intOrNull(h.buyerUserId),
    buyerDisplayName: trimOrNull(h.buyerDisplayName),
    slipNote: trimOrNull(h.slipNote),
  };
}

function mapLineCommodity(rawLine, commodities) {
  const code = String(rawLine?.code ?? "").trim();
  const commodityName = String(rawLine?.commodityName ?? rawLine?.name ?? "").trim();
  if (code) {
    const byCode = mapCommodityNameToId(code, commodities);
    if (byCode.mapped) {
      return byCode;
    }
  }
  if (commodityName) {
    return mapCommodityNameToId(commodityName, commodities);
  }
  return { commodityId: null, mapped: false, matchedName: null };
}

/**
 * @param {{
 *   llm: { header?: object, lines?: object[] },
 *   commodities: { id: number, name: string, code?: string|null }[],
 *   resolveLine: (args: { commodityId: number, priceKind: 'market' | 'tgsx', code: string|null }) => {
 *     lttpSupplierId?: number|null,
 *     unitPrice?: number|null,
 *   }|null|undefined,
 * }} input
 */
function enrichLlmIssueSlipDraft({ llm, commodities, resolveLine }) {
  const warnings = [];
  const headerDraft = buildHeaderDraft(llm?.header);
  const seenDedupe = new Set();
  const lines = [];

  for (const raw of llm?.lines || []) {
    const code = trimOrNull(raw?.code);
    const commodityName = String(raw?.commodityName ?? raw?.name ?? "").trim();
    const hit = mapLineCommodity(raw, commodities);
    const quantity = quantityOrNull(raw?.quantity);
    const priceKind = normalizeEnrichPriceKind(raw?.priceKind);

    const line = {
      commodityId: hit.mapped ? hit.commodityId : null,
      commodityName: hit.matchedName || commodityName || "",
      code,
      quantity,
      priceKind,
      lttpSupplierId: null,
      unitPrice: null,
      mapped: false,
    };

    if (!hit.mapped) {
      const label = commodityName || code || "?";
      warnings.push(`Chưa map LTTP «${label}».`);
      lines.push(line);
      continue;
    }

    if (quantity == null) {
      warnings.push(`Thiếu số lượng hợp lệ cho «${line.commodityName}».`);
      lines.push(line);
      continue;
    }

    if (priceKind == null) {
      warnings.push(`Thiếu hoặc sai loại giá cho «${line.commodityName}».`);
      lines.push(line);
      continue;
    }

    const dedupeKey = issueSlipLineDedupeKey(hit.commodityId, priceKind);
    if (dedupeKey && seenDedupe.has(dedupeKey)) {
      warnings.push(
        `Bỏ qua dòng trùng (commodityId ${hit.commodityId}, priceKind ${priceKind}).`,
      );
      continue;
    }
    if (dedupeKey) {
      seenDedupe.add(dedupeKey);
    }

    const resolved =
      typeof resolveLine === "function"
        ? resolveLine({ commodityId: hit.commodityId, priceKind, code })
        : null;
    const supplierId =
      resolved?.lttpSupplierId != null ? Number(resolved.lttpSupplierId) : null;
    const unitPrice =
      resolved?.unitPrice != null && Number.isFinite(Number(resolved.unitPrice))
        ? Number(resolved.unitPrice)
        : null;

    line.lttpSupplierId = Number.isInteger(supplierId) && supplierId > 0 ? supplierId : null;
    line.unitPrice = unitPrice;

    if (line.lttpSupplierId == null) {
      warnings.push(`Chưa resolve NCC cho «${line.commodityName}».`);
      lines.push(line);
      continue;
    }

    line.mapped = true;
    lines.push(line);
  }

  return { headerDraft, lines, warnings };
}

export { enrichLlmIssueSlipDraft, normalizeEnrichPriceKind, buildHeaderDraft };
