const SLIP_COLUMN_STYLE_COUNT = 8;

/** Tránh nhầm khi copy: tên không chứa `:` hay `;` hay xuống dòng. */
export function sanitizeOrderTextToken(s) {
  return String(s ?? "")
    .replace(/[\r\n:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mỗi phiếu: dòng 1 = đơn vị nhận + số phiếu (+ chú thích); dòng sau = từng mặt hàng.
 * Các phiếu cách nhau một dòng trống.
 */
export function buildOrderSharePlainText({ orderDate, storageUnitName, supplierFilterLabel, slipColumns }) {
  if (!Array.isArray(slipColumns) || slipColumns.length === 0) {
    return "";
  }
  const meta = [
    `Tổng hợp đặt hàng LTTP — ${orderDate}`,
    storageUnitName ? `Kho cấp phát: ${storageUnitName}` : null,
    `Lọc đối tác (dòng phiếu): ${supplierFilterLabel}`,
  ].filter(Boolean);

  const slipBlocks = slipColumns.map((col) => {
    const refLabel = slipRefLabel(col.bookMmyy, col.slipNo);
    const caption =
      col.note != null && String(col.note).trim() !== "" ? String(col.note).trim().replace(/[\r\n]+/g, " ") : null;
    const head = caption
      ? `${sanitizeOrderTextToken(col.recipientUnitName)} | ${refLabel} (${caption})`
      : `${sanitizeOrderTextToken(col.recipientUnitName)} | ${refLabel}`;
    const pairs = (col.lines || [])
      .filter((ln) => {
        const q = Number(ln.quantity);
        return Number.isFinite(q) && q !== 0;
      })
      .map((ln) => {
        const nm = sanitizeOrderTextToken(ln.name);
        const qf = String(ln.quantityFormatted ?? "").trim() || "0";
        const nt =
          ln.lineNote != null && String(ln.lineNote).trim() !== ""
            ? sanitizeOrderTextToken(ln.lineNote)
            : "";
        return nt ? `${nm}:${qf} (${nt})` : `${nm}:${qf}`;
      })
      .join(";");
    const bodyText = pairs
      ? pairs
          .split(";")
          .map((it) => it.trim())
          .filter(Boolean)
          .join("\n")
      : "(Không có mặt hàng)";
    return `${head}\n${bodyText}`;
  });

  return `${meta.join("\n")}\n\n${slipBlocks.join("\n\n")}`;
}

/** Nhãn đối tác trong dòng meta của text, cùng quy ước tab đặt hàng. */
export function orderSupplierFilterLabel(summary) {
  if (!summary?.supplierFilter || summary.supplierFilter === "all") return "Tất cả đối tác";
  if (summary.supplierFilter === "none") return "Chưa gán đối tác trên dòng phiếu";
  const sid = summary.supplierFilter;
  const row = summary.availableSuppliers?.find((s) => s.id != null && Number(s.id) === Number(sid));
  return row?.name ?? `Đối tác #${sid}`;
}

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
