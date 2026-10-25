/**
 * Khung một ngày cho mọi sổ. Số lấy từ view đã tính (computeLedger), không tính lại ở đây.
 */

function slipSource(priceKind) {
  return String(priceKind || "").toLowerCase() === "tgsx" ? "H" : "G";
}

function pulledSlips(slips) {
  return (slips || []).map((slip) => ({
    id: slip.id ?? null,
    slipNo: slip.slipNo ?? null,
    lines: (slip.lines || []).map((line) => ({
      commodityId: line.commodityId ?? null,
      name: line.commodity?.name || line.name || "",
      uom: line.commodity?.measureUnit || line.uom || "",
      qty: String(line.quantity ?? line.qty ?? "0"),
      unitPrice: line.unitPrice == null ? null : String(line.unitPrice),
      priceKind: line.priceKind || "market",
      source: slipSource(line.priceKind),
    })),
  }));
}

function slipDraftOf(suggestions, locked) {
  if (locked) return [];
  return (suggestions || [])
    .filter((row) => Number(row.suggestQty) > 0)
    .map((row) => ({
      commodityId: row.commodityId ?? null,
      name: row.name,
      uom: row.uom || "",
      unitPrice: row.unitPrice,
      qty: row.suggestQty,
      priceKind: "market",
      reason: "balance",
    }));
}

function buildDayFrame(view = {}, slips = []) {
  const structure = view.structure || {};
  const locked = view.status === "locked";
  return {
    unitId: view.unitId ?? null,
    date: view.date || "",
    status: view.status || "draft",
    locked,
    inputs: {
      headcount: view.headcount || null,
      otherIncome: view.otherIncome || null,
      selfSupply: structure.manual?.selfSupply || [],
      rice: structure.manual?.rice || [],
      otherOut: structure.manual?.otherOut || [],
      opening: structure.manual?.opening || [],
      schedule: view.schedule || null,
    },
    pulled: {
      carryFrom: view.carriedFrom ?? null,
      issueSlips: pulledSlips(slips),
      priceTable: view.priceTable || null,
    },
    books: {
      stock: {
        columns: structure.columns || [],
        rows: structure.rows || [],
        totals: structure.totals || null,
      },
      finance: view.finance || null,
      plan: view.plan || null,
    },
    slipDraft: slipDraftOf(view.suggestions, locked),
  };
}

export { buildDayFrame };
