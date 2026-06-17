const UNITS = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function readTens(n, forceZeroHundred = false) {
  if (n === 0) return "";
  if (n < 10) return forceZeroHundred ? `linh ${UNITS[n]}` : UNITS[n];
  if (n < 20) {
    if (n === 10) return "mười";
    if (n === 15) return "mười lăm";
    return `mười ${UNITS[n - 10]}`;
  }
  const t = Math.floor(n / 10);
  const u = n % 10;
  const tens = `${UNITS[t]} mươi`;
  if (u === 0) return tens;
  if (u === 1) return `${tens} mốt`;
  if (u === 5) return `${tens} lăm`;
  return `${tens} ${UNITS[u]}`;
}

function readGroup(n, forceFull = false) {
  const value = Number(n);
  if (!Number.isInteger(value) || value <= 0) return "";
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const parts = [];
  if (hundreds > 0) {
    parts.push(`${UNITS[hundreds]} trăm`);
  } else if (forceFull) {
    parts.push("không trăm");
  }
  if (rest > 0) {
    parts.push(readTens(rest, hundreds > 0 || forceFull));
  }
  return parts.join(" ");
}

/** Đọc số tiền VND thành chữ (một dòng, viết hoa chữ đầu). */
export function vndToVietnameseDocumentLine(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "Không đồng";
  const cap = (s) => (s ? s.charAt(0).toLocaleUpperCase("vi") + s.slice(1) : s);
  let r = n;
  const ty = Math.floor(r / 1_000_000_000);
  r %= 1_000_000_000;
  const trieu = Math.floor(r / 1_000_000);
  r %= 1_000_000;
  const nghin = Math.floor(r / 1_000);
  const don = r % 1000;
  const high = [];
  if (ty) high.push(`${readGroup(ty)} tỷ`);
  if (trieu) high.push(`${readGroup(trieu, ty > 0)} triệu`);
  if (nghin) high.push(`${readGroup(nghin, ty > 0 || trieu > 0)} nghìn`);
  const highStr = high.join(" ");
  if (don > 0) {
    const low = `${readGroup(don, high.length > 0)} đồng`;
    return cap(highStr ? `${highStr}, ${low}` : low);
  }
  return cap(`${highStr} đồng`);
}

export function formatVndNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Math.round(n).toLocaleString("vi-VN");
}
