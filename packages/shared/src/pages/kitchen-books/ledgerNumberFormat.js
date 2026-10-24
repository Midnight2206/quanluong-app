/**
 * Số trên sổ: dấu . ngăn nghìn, dấu , thập phân, không làm tròn.
 * @param {unknown} value
 * @param {{ blankZero?: boolean }} [options]
 */
export function formatLedgerNumber(value, { blankZero = true } = {}) {
  if (value == null || value === "") return blankZero ? "" : "0";
  const raw = String(value).trim().replace(/\s/g, "");
  if (!raw) return blankZero ? "" : "0";
  const neg = raw.startsWith("-");
  let body = neg ? raw.slice(1) : raw;
  if (body.includes(",")) {
    body = body.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(body)) return String(value);
  const [intPart, frac = ""] = body.split(".");
  const intNorm = intPart.replace(/^0+(?=\d)/, "") || "0";
  const fracTrim = frac.replace(/0+$/, "");
  if (blankZero && !neg && intNorm === "0" && !fracTrim) return "";
  const grouped = intNorm.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const shown = fracTrim ? `${grouped},${fracTrim}` : grouped;
  return neg ? `-${shown}` : shown;
}

/** Ô nhập: không chấm ngăn nghìn, để "16.000" không bị đọc thành 16. */
export function formatLedgerInput(value) {
  const shown = formatLedgerNumber(value, { blankZero: false });
  if (!shown) return "";
  if (shown.includes(",") || /^-?\d{1,3}(\.\d{3})+$/.test(shown)) {
    return shown.replace(/\./g, "");
  }
  return shown;
}

/** @param {unknown} value @returns {number | null} */
export function parseViNumber(value) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw || raw === "–" || raw === "-") return null;
  const neg = raw.startsWith("-");
  let body = neg ? raw.slice(1) : raw;
  if (body.includes(",")) {
    body = body.replace(/\./g, "").replace(",", ".");
  } else if ((body.match(/\./g) || []).length > 1) {
    body = body.replace(/\./g, "");
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(body)) {
    body = body.replace(/\./g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(body)) return null;
  const n = Number(body);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
