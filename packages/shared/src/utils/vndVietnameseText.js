/**
 * Đọc số nguyên dương thành chữ (tiếng Việt), phần nguyên của VNĐ.
 * @param {number} n
 * @returns {string}
 */
function readGroup(n) {
  const d = [
    "không",
    "một",
    "hai",
    "ba",
    "bốn",
    "năm",
    "sáu",
    "bảy",
    "tám",
    "chín",
  ];
  const c = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts = [];
  if (c > 0) {
    parts.push(d[c] + " trăm");
  }
  if (t > 0) {
    if (t === 1) {
      parts.push(u > 0 ? "mười" : "mười");
    } else {
      parts.push(d[t] + " mươi");
    }
  } else if (c > 0 && u > 0) {
    parts.push("lẻ");
  }
  if (u > 0) {
    if (u === 1 && t > 0 && t !== 1) {
      parts.push("mốt");
    } else if (u === 5 && t > 0) {
      parts.push("lăm");
    } else {
      parts.push(d[u]);
    }
  } else if (c === 0 && t === 0 && n === 0) {
    return d[0];
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Số tiền VNĐ (đồng) → câu đọc bằng chữ (dùng tổng, làm tròn đồng).
 * @param {number} value
 * @returns {string}
 */
export function vndToVietnameseText(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) {
    return "";
  }
  if (n === 0) {
    return "Không đồng";
  }
  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ", "tỷ tỷ"];
  const chunks = [];
  let t = n;
  while (t > 0) {
    chunks.push(t % 1000);
    t = Math.floor(t / 1000);
  }
  const parts = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i];
    if (c === 0) {
      continue;
    }
    const read = readGroup(c);
    const s = i < scales.length ? scales[i] : "";
    parts.push(s ? `${read} ${s}`.trim() : read);
  }
  return `${parts.join(" ")} đồng chẵn`.replace(/\s+/g, " ").trim();
}

/**
 * Dòng đọc tiền dạng công văn / mẫu kho: «Ba trăm bảy mươi ba ngàn, sáu trăm đồng».
 * Dùng «ngàn»; phần dưới 1000 sau dấu phẩy.
 * @param {number} value
 * @returns {string}
 */
export function vndToVietnameseDocumentLine(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) {
    return "";
  }
  if (n === 0) {
    return "Không đồng";
  }
  const cap = (s) => {
    const t = s.trim();
    if (!t) {
      return t;
    }
    return t.charAt(0).toLocaleUpperCase("vi") + t.slice(1);
  };
  let r = n;
  const tỷ = Math.floor(r / 1_000_000_000);
  r %= 1_000_000_000;
  const triệu = Math.floor(r / 1_000_000);
  r %= 1_000_000;
  const ngàn = Math.floor(r / 1_000);
  const đơn = r % 1000;
  const high = [];
  if (tỷ) {
    high.push(`${readGroup(tỷ)} tỷ`);
  }
  if (triệu) {
    high.push(`${readGroup(triệu)} triệu`);
  }
  if (ngàn) {
    high.push(`${readGroup(ngàn)} ngàn`);
  }
  const highStr = high.join(" ");
  if (đơn > 0) {
    const low = `${readGroup(đơn)} đồng`;
    if (highStr) {
      return cap(`${highStr}, ${low}`);
    }
    return cap(low);
  }
  if (highStr) {
    return cap(`${highStr} đồng chẵn`);
  }
  return "Không đồng";
}
