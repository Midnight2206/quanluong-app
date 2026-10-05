import { normalizeCommodityName } from "../kitchen-books/kitchen-books-menu-ai-map.js";
import { OMITTED_UOM, convertQuantity } from "./lttp-issue-slip-ai-uom.js";
import { quantityTokenForConvert } from "./lttp-issue-slip-ai-line-note.js";

function normalizePatchOp(raw) {
  const sku = raw?.sku_id ?? raw?.skuId;
  const qty = raw?.qty;
  return {
    lineId: Number(raw?.line_id ?? raw?.lineId),
    skuId: sku == null || sku === "" ? null : Number(sku),
    qty: qty == null || qty === "" ? null : Number(qty),
    unit: raw?.unit == null ? null : String(raw.unit).trim(),
    writtenUom: raw?.writtenUom == null ? null : String(raw.writtenUom).trim(),
  };
}

function normalizeRuleSuggestion(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "alias" && String(raw.raw || "").trim() && Number(raw.commodityId) > 0) {
    return {
      type: "alias",
      raw: String(raw.raw).trim().slice(0, 255),
      commodityId: Number(raw.commodityId),
    };
  }
  if (raw.type === "uom" && String(raw.fromUom || "").trim() && Number(raw.factor) >= 2) {
    return {
      type: "uom",
      fromUom: String(raw.fromUom).trim().slice(0, 64),
      factor: Math.round(Number(raw.factor)),
      commodityId: Number(raw.commodityId) > 0 ? Number(raw.commodityId) : null,
    };
  }
  if (raw.type === "qty") {
    const factor = Math.round(Number(raw.factor));
    if (factor < 1 || factor > 500) return null;
    const from = String(raw.fromUom || "").trim();
    const lineId = Number(raw.line_id ?? raw.lineId);
    return {
      type: "qty",
      fromUom: from ? from.slice(0, 64) : OMITTED_UOM,
      factor,
      lineId: lineId > 0 ? lineId : null,
      commodityId: null,
      commodityNameNorm: null,
    };
  }
  if (raw.type === "line_note" && typeof raw.enabled === "boolean") {
    return { type: "line_note", enabled: raw.enabled };
  }
  return null;
}

function scopeQtyRule(rule, lines) {
  if (!rule || rule.type !== "qty") return rule ?? null;
  const targets = (lines || []).filter((line) => !rule.lineId || rule.lineId === line.id);
  const ids = [...new Set(targets.map((line) => line.commodityId).filter((id) => Number(id) > 0))];
  if (ids.length !== 1) return { ...rule, commodityId: null, commodityNameNorm: null };
  const line = targets.find((item) => item.commodityId === ids[0]);
  return {
    ...rule,
    commodityId: ids[0],
    commodityNameNorm: normalizeCommodityName(line?.commodityName || line?.rawName || "") || null,
  };
}

function qtyRuleOps(rule, lines, commodities) {
  if (!rule || rule.type !== "qty") return [];
  const byId = new Map((commodities || []).map((item) => [item.id, item]));
  const ops = [];
  for (const line of lines || []) {
    if (rule.lineId && rule.lineId !== line.id) continue;
    if (line.status === "needs_confirm" && !(Number(line.commodityId) > 0)) continue;
    const stock = byId.get(line.commodityId)?.measureUnit || line.measureUnit || null;
    const written =
      line.writtenQty != null && String(line.writtenQty).trim() !== "" ? line.writtenQty : line.quantity;
    const qty = Number(String(quantityTokenForConvert(written) ?? "").replace(",", "."));
    if (!(qty > 0) || !stock) continue;
    const next = Math.round(qty * rule.factor * 10000) / 10000;
    if (!(next > 0)) continue;
    const op = { line_id: line.id, qty: next, unit: stock };
    // Keep the customer unit so the slip note can show "8 lit" after 1 lit = 6 hộp.
    if (!line.writtenUom && rule.fromUom && rule.fromUom !== "*") op.writtenUom = rule.fromUom;
    ops.push(op);
  }
  return ops;
}

function lineBefore(line) {
  return {
    commodityId: line.commodityId ?? null,
    commodityName: line.commodityName ?? null,
    code: line.code ?? null,
    quantity: line.quantity == null ? null : Number(line.quantity),
    measureUnit: line.measureUnit ?? null,
    writtenUom: line.writtenUom ?? null,
    writtenQty: line.writtenQty ?? null,
    lttpSupplierId: line.lttpSupplierId ?? null,
    unitPrice: line.unitPrice == null ? null : Number(line.unitPrice),
    status: line.status,
  };
}

function validateAndResolvePatch({ ops, tickedIds, lines, commodities, rules }) {
  const lineById = new Map((lines || []).map((line) => [line.id, line]));
  const commodityById = new Map((commodities || []).map((item) => [item.id, item]));
  const allowed = new Set(tickedIds || []);
  const kept = [];
  const dropped = [];
  for (const raw of ops || []) {
    const op = normalizePatchOp(raw);
    const line = lineById.get(op.lineId);
    if (!allowed.has(op.lineId) || !line) {
      dropped.push({ lineId: op.lineId, reason: "Không thuộc dòng đã chọn" });
      continue;
    }
    if (line.status === "needs_confirm" && !(Number(line.commodityId) > 0)) {
      dropped.push({ lineId: op.lineId, reason: "Dòng cần xác nhận dùng nút chọn" });
      continue;
    }
    let skuId = line.commodityId ?? null;
    if (op.skuId != null) {
      if (!commodityById.has(op.skuId)) {
        dropped.push({ lineId: op.lineId, reason: "SKU không có trong danh sách" });
        continue;
      }
      skuId = op.skuId;
    }
    const commodity = skuId != null ? commodityById.get(skuId) : null;
    let quantity = line.quantity == null ? null : Number(line.quantity);
    let measureUnit = line.measureUnit ?? null;
    if (op.qty != null) {
      if (!(op.qty > 0)) {
        dropped.push({ lineId: op.lineId, reason: "Số lượng không hợp lệ" });
        continue;
      }
      quantity = op.qty;
    }
    const stockUom = commodity?.measureUnit || line.measureUnit;
    if (op.unit) {
      const converted = convertQuantity({
        writtenQty: quantity,
        writtenUom: op.unit,
        stockUom,
        habitUom: line.measureUnit,
        commodityId: skuId,
        rules,
        unitPrice: line.unitPrice,
        skipMoney: true,
      });
      if (converted.needsConfirm || !(converted.quantity > 0)) {
        dropped.push({ lineId: op.lineId, reason: "Chưa quy đổi được đơn vị" });
        continue;
      }
      quantity = converted.quantity;
      measureUnit = converted.measureUnit ?? measureUnit;
    }
    if (!(quantity > 0)) {
      dropped.push({ lineId: op.lineId, reason: "Số lượng không hợp lệ" });
      continue;
    }
    const sameSku = skuId === line.commodityId;
    const writtenUom = op.writtenUom || "";
    kept.push({
      lineId: op.lineId,
      before: lineBefore(line),
      after: {
        commodityId: skuId,
        commodityName: commodity?.name || line.commodityName || null,
        code: commodity?.code || line.code || null,
        quantity,
        measureUnit,
        ...(writtenUom ? { writtenUom: writtenUom.slice(0, 64) } : {}),
        lttpSupplierId: sameSku
          ? line.lttpSupplierId ?? null
          : commodity?.lttpSupplierId ?? null,
        unitPrice: line.unitPrice == null ? null : Number(line.unitPrice),
        status: "edited",
      },
    });
  }
  return { kept, dropped };
}

export { normalizeRuleSuggestion, qtyRuleOps, scopeQtyRule, validateAndResolvePatch };
