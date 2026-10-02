import { convertQuantity } from "./lttp-issue-slip-ai-uom.js";

function normalizePatchOp(raw) {
  const sku = raw?.sku_id ?? raw?.skuId;
  const qty = raw?.qty;
  return {
    lineId: Number(raw?.line_id ?? raw?.lineId),
    skuId: sku == null || sku === "" ? null : Number(sku),
    qty: qty == null || qty === "" ? null : Number(qty),
    unit: raw?.unit == null ? null : String(raw.unit).trim(),
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
  return null;
}

function lineBefore(line) {
  return {
    commodityId: line.commodityId ?? null,
    commodityName: line.commodityName ?? null,
    code: line.code ?? null,
    quantity: line.quantity == null ? null : Number(line.quantity),
    measureUnit: line.measureUnit ?? null,
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
    if (line.status === "needs_confirm") {
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
    if (op.unit) {
      const converted = convertQuantity({
        writtenQty: quantity,
        writtenUom: op.unit,
        stockUom: commodity?.measureUnit || line.measureUnit,
        habitUom: line.measureUnit,
        commodityId: skuId,
        rules,
        unitPrice: line.unitPrice,
      });
      if (converted.needsConfirm || !(converted.quantity > 0)) {
        dropped.push({ lineId: op.lineId, reason: "Chưa quy đổi được đơn vị" });
        continue;
      }
      quantity = converted.quantity;
      measureUnit = converted.measureUnit;
    }
    if (!(quantity > 0)) {
      dropped.push({ lineId: op.lineId, reason: "Số lượng không hợp lệ" });
      continue;
    }
    const sameSku = skuId === line.commodityId;
    kept.push({
      lineId: op.lineId,
      before: lineBefore(line),
      after: {
        commodityId: skuId,
        commodityName: commodity?.name || line.commodityName || null,
        code: commodity?.code || line.code || null,
        quantity,
        measureUnit,
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

export { normalizeRuleSuggestion, validateAndResolvePatch };
