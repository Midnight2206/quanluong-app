/**
 * Sửa phiếu xuất rồi ghép lại vào sổ. Số lượng mới là bản sao, không sửa mảng đầu vào.
 * Cân đối là dòng riêng, ghi chú BALANCE_NOTE, không cộng vào dòng xuất ăn.
 */
const BALANCE_NOTE = "Cân đối sổ";

function priceKindOf(value) {
  return String(value || "").toLowerCase() === "tgsx" ? "tgsx" : "market";
}

function lineKey(line) {
  return `${Number(line.commodityId)}:${priceKindOf(line.priceKind)}`;
}

function addQty(left, right) {
  const sum = Number(left) + Number(right);
  if (!Number.isFinite(sum)) return String(left ?? "0");
  return String(Math.round(sum * 10000) / 10000);
}

function normalizeSlipLines(slips) {
  const out = [];
  for (const slip of slips || []) {
    for (const line of slip.lines || []) {
      out.push({
        slipId: slip.id ?? null,
        lineId: line.id ?? null,
        commodityId: line.commodityId ?? null,
        priceKind: priceKindOf(line.priceKind),
        quantity: String(line.quantity ?? "0"),
        unitPrice: line.unitPrice,
        name: line.commodity?.name || line.name || "",
        lineNote: line.lineNote || "",
      });
    }
  }
  return out;
}

function editSlipLines(lines, edits) {
  const pending = new Map((edits || []).map((row) => [lineKey(row), row]));
  return (lines || []).map((line) => {
    const key = lineKey(line);
    const edit = pending.get(key);
    if (!edit) return { ...line };
    pending.delete(key);
    return { ...line, quantity: String(edit.quantity) };
  });
}

function mergeSlipDraft(lines, draft) {
  const next = (lines || []).map((line) => ({ ...line }));
  const hostSlipId = next.find((line) => line.slipId)?.slipId ?? null;
  for (const item of draft || []) {
    const add = Number(item.qty ?? item.quantity);
    if (!Number.isFinite(add) || add <= 0) continue;
    const key = lineKey({ commodityId: item.commodityId, priceKind: item.priceKind });
    const index = next.findIndex((line) => lineKey(line) === key && line.lineNote === BALANCE_NOTE);
    if (index >= 0) {
      next[index] = { ...next[index], quantity: addQty(next[index].quantity, add) };
      continue;
    }
    if (!item.commodityId) continue;
    next.push({
      slipId: hostSlipId,
      lineId: null,
      commodityId: Number(item.commodityId),
      priceKind: priceKindOf(item.priceKind),
      quantity: String(add),
      unitPrice: item.unitPrice,
      name: item.name || "",
      lineNote: BALANCE_NOTE,
    });
  }
  return next;
}

function slipLineChanges(before, after) {
  const prev = new Map((before || []).filter((line) => line.lineId).map((line) => [line.lineId, line.quantity]));
  const updates = [];
  const creates = [];
  const skipped = [];
  for (const line of after || []) {
    if (line.lineId) {
      if (Number(prev.get(line.lineId)) !== Number(line.quantity)) updates.push(line);
    } else if (line.commodityId) {
      creates.push(line);
    } else if (Number(line.quantity) > 0) {
      skipped.push(line);
    }
  }
  return { updates, creates, skipped };
}

export { BALANCE_NOTE, editSlipLines, mergeSlipDraft, normalizeSlipLines, slipLineChanges };
