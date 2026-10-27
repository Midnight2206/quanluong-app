import { createHash } from "node:crypto";
import { classifyItem } from "./kitchen-ledger-compute.js";
import { scaledToString, toScaled } from "./kitchen-ledger-decimal.js";
import { mergeLedgerSettings, normalizeName } from "./kitchen-ledger-settings.js";

const COLUMNS = ["G", "H", "I", "J"];

function sameMoney(a, b) {
  return scaledToString(toScaled(a)) === scaledToString(toScaled(b));
}

function fingerprintIssueSlips(slips) {
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
  parts.sort();
  return createHash("sha256").update(parts.join("\n")).digest("hex");
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

function manualRiceNames(movements, commodityById) {
  const names = new Set();
  for (const movement of movements || []) {
    if (movement.kind !== "rice") continue;
    const named = resolveCommodity(movement, commodityById);
    if (named.name) names.add(normalizeName(named.name));
  }
  return names;
}

/**
 * Ghép phiếu xuất, bảng giá và dòng người dùng thành đầu vào của computeLedger.
 * Thiếu phiếu hoặc thiếu bảng giá không chặn ngày. G/H lấy từ phiếu.
 * Gạo nhập tay giữ nguyên và không cộng thêm dòng gạo trùng tên trên phiếu.
 */
function assembleLedgerInput({
  date,
  settings,
  slips = [],
  movements = [],
  priceRows = [],
  openingLots = [],
  commodityById = new Map(),
}) {
  const s = mergeLedgerSettings(settings);
  const warnings = [];
  const priceById = new Map(priceRows.map((row) => [Number(row.commodityId), row]));
  const keptRice = manualRiceNames(movements, commodityById);

  const receipts = [];
  const otherIssues = [];
  const mealIssues = [];
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
      const role = classifyItem(name, uom, s);
      if (role === "rice" && keptRice.has(normalizeName(name))) {
        warnings.push({
          code: "rice_manual_kept",
          message: `Giữ gạo nhập tay (${name}). Không cộng thêm dòng cùng tên trên phiếu.`,
        });
        continue;
      }
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

  for (const movement of movements) {
    if (movement.kind === "opening") {
      resolvedOpening.push(movementToOpening(movement, commodityById));
      continue;
    }
    if (movement.kind === "balance") continue;
    const named = resolveCommodity(movement, commodityById);
    if (movement.kind === "other_out" || movement.kind === "meal_out") {
      if (!named.name) {
        warnings.push({
          code: movement.kind === "meal_out" ? "meal_out_name" : "other_out_name",
          message: movement.kind === "meal_out" ? "Xuất ăn thiếu tên mặt hàng." : "Xuất khác thiếu tên mặt hàng.",
        });
        continue;
      }
      const target = movement.kind === "meal_out" ? mealIssues : otherIssues;
      target.push({
        name: named.name,
        uom: named.uom,
        qty: movement.qty,
        unitPrice: movement.unitPrice,
        commodityId: named.commodityId,
      });
      continue;
    }
    if (!["self_supply", "rice"].includes(movement.kind)) continue;
    const source = movement.kind === "rice"
      ? (COLUMNS.includes(movement.source) ? movement.source : "")
      : (movement.source === "J" ? "J" : "I");
    if (movement.kind === "rice" && !source) {
      warnings.push({
        code: "rice_column",
        message: `Chọn cột G, H, I hoặc J cho ${named.name || "gạo"}.`,
      });
      continue;
    }
    const role = classifyItem(named.name, named.uom, s);
    if (movement.kind === "rice" && role !== "rice") {
      warnings.push({
        code: "rice_only",
        message: "Dòng gạo không phải gạo. Không ghi vào sổ.",
      });
      continue;
    }
    const listPrice = named.commodityId ? priceOf(priceById.get(Number(named.commodityId)), source) : null;
    const unitPrice = listPrice ?? movement.unitPrice;
    if (unitPrice == null || unitPrice === "") {
      warnings.push({
        code: "missing_price",
        name: named.name,
        message: `Chưa có giá cho ${named.name || "dòng nhập"}. Dòng này chưa vào sổ.`,
      });
      continue;
    }
    receipts.push({
      source,
      name: named.name,
      uom: named.uom,
      unitPrice,
      qty: movement.qty,
      commodityId: named.commodityId,
      manualTemporary: movement.kind === "rice",
      ...named.group,
    });
  }

  return {
    blockers: [],
    warnings,
    fingerprint: fingerprintIssueSlips(slips),
    slipCount: slips.length,
    input: {
      date,
      settings: s,
      receipts,
      otherIssues,
      mealIssues,
      openingLots: resolvedOpening,
    },
  };
}

function resolveCommodity(movement, commodityById) {
  const commodity = movement.commodityId ? commodityById.get(Number(movement.commodityId)) : null;
  return {
    name: commodity?.name || movement.itemName || "",
    uom: commodity?.measureUnit || movement.measureUnit || "",
    commodityId: movement.commodityId ?? null,
    group: groupMeta(commodity),
  };
}

function movementToOpening(movement, commodityById) {
  const named = resolveCommodity(movement, commodityById);
  return {
    name: named.name,
    uom: named.uom,
    unitPrice: movement.unitPrice,
    qty: movement.qty,
    commodityId: named.commodityId,
    receivedDate: "1970-01-01",
    ...named.group,
  };
}

export { assembleLedgerInput, fingerprintIssueSlips };
