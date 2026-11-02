import { createHash } from "node:crypto";
import { scaledToString, toScaled } from "./kitchen-ledger-decimal.js";
import { mergeLedgerSettings } from "./kitchen-ledger-settings.js";

function sameMoney(a, b) {
  return scaledToString(toScaled(a)) === scaledToString(toScaled(b));
}

function fingerprintIssueSlips(slips, mealSlipLines = []) {
  const parts = [];
  for (const slip of slips || []) {
    const updated = slip.updatedAt instanceof Date ? slip.updatedAt.toISOString() : String(slip.updatedAt ?? "");
    for (const line of slip.lines || []) {
      parts.push(
        [
          slip.id,
          updated,
          line.commodityId,
          line.priceKind || "market",
          String(line.quantity),
          String(line.unitPrice),
          line.tgsxPrice == null ? "" : String(line.tgsxPrice),
        ].join("|"),
      );
    }
  }
  for (const line of mealSlipLines || []) {
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty === 0) continue;
    parts.push(["meal", line.commodityId ?? "", String(line.qty), String(line.unitPrice ?? "")].join("|"));
  }
  parts.sort();
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

function mealIssuesFromLines(lines) {
  const out = [];
  for (const line of lines || []) {
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    out.push({
      name: line.name || "",
      uom: line.uom || "",
      unitPrice: line.unitPrice,
      qty,
      commodityId: line.commodityId ?? null,
    });
  }
  return out;
}

function groupMeta(commodity) {
  if (!commodity) return { groupCode: "", groupSort: null };
  const group = commodity.group;
  const sort = commodity.groupSort ?? group?.sortOrder;
  return {
    groupCode: commodity.groupCode || group?.code || "",
    groupSort: Number.isFinite(sort) ? sort : null,
  };
}

function priceOf(row, source) {
  if (!row) return null;
  if (source === "H" || source === "J") return row.tgsxPrice ?? null;
  return row.unitPrice ?? null;
}

/**
 * Số lượng chỉ từ phiếu. G/H từ phiếu xuất cấp 1. I/J từ phiếu nhập của đơn vị (unitSlipLines).
 * Dòng nhập tay cũ trên sổ được đếm, không cộng vào số và không bị xóa.
 */
function assembleLedgerInput({
  date,
  settings,
  slips = [],
  movements = [],
  unitSlipLines = [],
  priceRows = [],
  openingLots = [],
  commodityById = new Map(),
  mealSlipLines = [],
}) {
  const s = mergeLedgerSettings(settings);
  const warnings = [];
  const priceById = new Map(priceRows.map((row) => [Number(row.commodityId), row]));
  const manualEntryCounts = { self_supply: 0, rice: 0, meal_out: 0, other_out: 0, opening: 0 };
  for (const movement of movements || []) {
    if (Object.prototype.hasOwnProperty.call(manualEntryCounts, movement.kind)) {
      manualEntryCounts[movement.kind] += 1;
    }
  }

  const receipts = [];
  const otherIssues = [];
  const resolvedOpening = openingLots.map((lot) => {
    const group = groupMeta(lot.commodityId ? commodityById.get(Number(lot.commodityId)) : null);
    return {
      ...lot,
      groupCode: lot.groupCode || group.groupCode,
      groupSort: lot.groupSort ?? group.groupSort,
    };
  });

  for (const slip of slips) {
    for (const line of slip.lines || []) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const commodity = line.commodity || commodityById.get(Number(line.commodityId));
      const name = commodity?.name || line.itemName || "";
      const uom = commodity?.measureUnit || line.measureUnit || "";
      const source = String(line.priceKind || "").toLowerCase() === "tgsx" ? "H" : "G";
      const listPrice = priceOf(priceById.get(Number(line.commodityId)), source);
      if (listPrice == null) {
        warnings.push({
          code: "missing_price",
          name,
          message: `Chưa có giá ${source === "H" ? "TGSX" : "mua TT"} cho ${name}. Dòng này chưa vào sổ.`,
        });
        continue;
      }
      const slipPrice = source === "H" ? line.tgsxPrice ?? line.unitPrice : line.unitPrice;
      if (slipPrice != null && !sameMoney(slipPrice, listPrice)) {
        warnings.push({
          code: "price_diff",
          message: `${name}: giá trên phiếu khác bảng giá hiệu lực. Sổ lấy giá bảng giá.`,
        });
      }
      receipts.push({
        source,
        name,
        uom,
        unitPrice: listPrice,
        qty,
        commodityId: line.commodityId,
        ...groupMeta(commodity),
      });
    }
  }

  for (const line of unitSlipLines || []) {
    const source = line.source === "J" ? "J" : "I";
    const commodity = line.commodity || commodityById.get(Number(line.commodityId));
    const name = commodity?.name || line.name || "";
    const uom = commodity?.measureUnit || line.uom || "";
    const qty = Number(line.qty ?? line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const listPrice = priceOf(priceById.get(Number(line.commodityId)), source);
    const unitPrice = listPrice ?? line.unitPrice;
    if (unitPrice == null || unitPrice === "") {
      warnings.push({
        code: "missing_price",
        name,
        message: `Chưa có giá cho ${name || "dòng phiếu nhập"}. Dòng này chưa vào sổ.`,
      });
      continue;
    }
    receipts.push({
      source,
      name,
      uom,
      unitPrice,
      qty,
      commodityId: line.commodityId,
      ...groupMeta(commodity),
    });
  }

  return {
    blockers: [],
    warnings,
    fingerprint: fingerprintIssueSlips(slips, mealSlipLines),
    slipCount: slips.length,
    manualEntryCounts,
    input: {
      date,
      settings: s,
      receipts,
      otherIssues,
      mealIssues: mealIssuesFromLines(mealSlipLines),
      openingLots: resolvedOpening,
    },
  };
}

export { assembleLedgerInput, fingerprintIssueSlips };
