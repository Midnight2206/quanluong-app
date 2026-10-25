import { createHash } from "node:crypto";
import { BALANCE_NOTE } from "./kitchen-ledger-slip-roundtrip.js";
import { classifyItem } from "./kitchen-ledger-compute.js";
import { scaledToString, toScaled } from "./kitchen-ledger-decimal.js";
import { mergeLedgerSettings, normalizeName } from "./kitchen-ledger-settings.js";

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

function priceOf(row, source) {
  if (!row) return null;
  if (source === "H" || source === "J") return row.tgsxPrice ?? null;
  return row.unitPrice ?? null;
}

/**
 * Ghép phiếu xuất, bảng giá và dòng người dùng thành đầu vào của computeLedger.
 * Cột Trên BĐ chỉ lấy từ phiếu. Gạo trên phiếu bị bỏ (nhập tay).
 */
function assembleLedgerInput({
  date,
  settings,
  slips = [],
  movements = [],
  priceRows = [],
  priceTablePresent = false,
  openingLots = [],
  commodityById = new Map(),
}) {
  const s = mergeLedgerSettings(settings);
  const blockers = [];
  const warnings = [];
  const priceById = new Map(priceRows.map((row) => [Number(row.commodityId), row]));

  if (s.requireIssueSlip && slips.length === 0) {
    blockers.push({
      code: "missing_issue_slip",
      message: "Chưa có phiếu xuất LTTP (Trên BĐ) cho ngày này. Chưa lập sổ.",
    });
  }
  if (s.requirePriceTable && !priceTablePresent) {
    blockers.push({
      code: "missing_price_table",
      message: "Chưa có bảng giá hiệu lực cho ngày này. Chưa lập sổ.",
    });
  }

  const receipts = [];
  const otherIssues = [];
  const issuePolicies = {};
  const resolvedOpening = openingLots.map((lot) => ({ ...lot }));

  for (const slip of slips) {
    for (const line of slip.lines || []) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const commodity = line.commodity || commodityById.get(Number(line.commodityId));
      const name = commodity?.name || line.itemName || "";
      const uom = commodity?.measureUnit || line.measureUnit || "";
      const role = classifyItem(name, uom, s);
      if (role === "rice" && s.riceManualOnGuarantee) {
        warnings.push({
          code: "rice_on_slip_ignored",
          message: `Gạo trên phiếu xuất (${name}) không ghi vào Trên BĐ. Nhập dòng gạo bằng tay.`,
        });
        continue;
      }
      const balanceLine = String(line.lineNote || "") === BALANCE_NOTE;
      const source = String(line.priceKind || "").toLowerCase() === "tgsx" ? "H" : "G";
      const listPrice = priceOf(priceById.get(Number(line.commodityId)), source);
      if (listPrice == null) {
        blockers.push({
          code: "missing_price",
          message: `Chưa có giá ${source === "H" ? "TGSX" : "mua TT"} cho ${name}.`,
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
        balance: balanceLine,
        issuePolicy: "today",
      });
    }
  }

  for (const movement of movements) {
    if (movement.kind === "opening") {
      resolvedOpening.push(movementToOpening(movement, commodityById));
      continue;
    }
    if (movement.kind === "other_out") {
      const named = resolveCommodity(movement, commodityById);
      if (!named.name) {
        blockers.push({ code: "other_out_name", message: "Xuất khác thiếu tên mặt hàng." });
        continue;
      }
      otherIssues.push({ name: named.name, qty: movement.qty });
      continue;
    }
    if (!["self_supply", "balance", "rice"].includes(movement.kind)) continue;
    const named = resolveCommodity(movement, commodityById);
    const source = movement.kind === "rice" ? "G" : movement.source === "J" ? "J" : "I";
    const role = classifyItem(named.name, named.uom, s);
    if (movement.kind === "rice" && role !== "rice") {
      blockers.push({
        code: "rice_only",
        message: "Chỉ gạo được nhập tay vào Trên BĐ mua TT.",
      });
      continue;
    }
    const listPrice = named.commodityId ? priceOf(priceById.get(Number(named.commodityId)), source) : null;
    const unitPrice = movement.kind === "balance"
      ? (movement.unitPrice ?? listPrice)
      : (listPrice ?? movement.unitPrice);
    if (unitPrice == null) {
      blockers.push({
        code: "missing_price",
        message: `Chưa có giá cho ${named.name || "dòng nhập"}.`,
      });
      continue;
    }
    if (movement.issuePolicy) issuePolicies[named.name] = movement.issuePolicy;
    receipts.push({
      source,
      name: named.name,
      uom: named.uom,
      unitPrice,
      qty: movement.qty,
      commodityId: named.commodityId,
      balance: movement.kind === "balance",
      issuePolicy: movement.issuePolicy || (movement.kind === "balance" ? "keep" : "today"),
    });
  }

  const priceHints = priceRows
    .filter((row) => ["rice", "spice", "milk", "fuel"].includes(classifyItem(row.name, row.measureUnit, s)))
    .map((row) => ({
      name: row.name,
      uom: row.measureUnit,
      unitPrice: row.unitPrice,
      commodityId: row.commodityId,
      role: classifyItem(row.name, row.measureUnit, s),
    }));

  return {
    blockers,
    warnings,
    fingerprint: fingerprintIssueSlips(slips),
    slipCount: slips.length,
    input: {
      date,
      settings: s,
      receipts,
      otherIssues,
      openingLots: resolvedOpening,
      issuePolicies,
      priceHints,
    },
  };
}

function resolveCommodity(movement, commodityById) {
  const commodity = movement.commodityId ? commodityById.get(Number(movement.commodityId)) : null;
  return {
    name: commodity?.name || movement.itemName || "",
    uom: commodity?.measureUnit || movement.measureUnit || "",
    commodityId: movement.commodityId ?? null,
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
  };
}

export { assembleLedgerInput, fingerprintIssueSlips };
