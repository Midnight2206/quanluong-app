const SLIP_COLUMN_STYLE_COUNT = 8;

/** Quyển + số phiếu — nhãn phân biệt khi cùng đơn vị nhiều phiếu. */
export function slipRefLabel(bookMmyy, slipNo) {
  const sn = slipNo != null && Number.isFinite(Number(slipNo)) ? String(Number(slipNo)).padStart(4, "0") : "—";
  const b = bookMmyy != null && String(bookMmyy).trim() !== "" ? String(bookMmyy).trim() : "—";
  return `Q.${b}-${sn}`;
}

export function buildOrderingMatrix(summary) {
  if (!summary?.grandTotals?.length && !summary?.slipColumns?.length) {
    return null;
  }

  const slips = [...(summary.slipColumns || [])];

  /** @type {{ key: string; slipId: number; recipientUnitName: string; caption: string|null; refLabel: string; styleIdx: number }[]} */
  const columns = slips.map((col, i) => ({
    key: `slip-${col.slipId}`,
    slipId: col.slipId,
    recipientUnitName: col.recipientUnitName,
    caption: col.note != null && String(col.note).trim() !== "" ? String(col.note).trim() : null,
    refLabel: slipRefLabel(col.bookMmyy, col.slipNo),
    // ponytail: keep in sync with the fixed slip tint palette in LttpOrderingTab.
    styleIdx: i % SLIP_COLUMN_STYLE_COUNT,
  }));

  const rows = [...(summary.grandTotals || [])].sort((a, b) => a.name.localeCompare(b.name, "vi"));

  /** @type {Map<string, Map<number, { quantityFormatted: string; lineNote: string | null }>>} */
  const qtyBySlip = new Map();
  for (const s of slips) {
    const key = `slip-${s.slipId}`;
    const qtyByCommodity = new Map();
    for (const line of s.lines || []) {
      const lineNote =
        line.lineNote != null && String(line.lineNote).trim() !== "" ? String(line.lineNote).trim() : null;
      qtyByCommodity.set(line.commodityId, {
        quantityFormatted: line.quantityFormatted,
        lineNote,
      });
    }
    qtyBySlip.set(key, qtyByCommodity);
  }

  return { columns, rows, qtyBySlip };
}
