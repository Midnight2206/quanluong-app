/**
 * Chuẩn hoá COOKIE_DOMAIN cho cookie httpOnly dùng chung subdomain.
 * Sai giá trị → trình duyệt từ chối Set-Cookie (login xong mất cookie).
 *
 * @param {string | null | undefined} raw
 * @param {string | null | undefined} publicWebUrl vd. https://quanluong.trankhanhan.site
 * @returns {string | undefined} vd. `.trankhanhan.site`
 */
export function normalizeCookieDomain(raw, publicWebUrl) {
  if (raw == null || String(raw).trim() === "") {
    return undefined;
  }
  let d = String(raw).trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0] ?? d;
  d = d.split(":")[0] ?? d;
  d = d.replace(/^\.+/, "");
  if (!d || d.includes(" ") || !d.includes(".")) {
    return undefined;
  }

  let host = "";
  try {
    if (publicWebUrl) {
      host = new URL(String(publicWebUrl).trim()).hostname.toLowerCase();
    }
  } catch {
    host = "";
  }

  // User hay ghi nhầm COOKIE_DOMAIN=quanluong.trankhanhan.site (host app)
  // → phải là parent .trankhanhan.site mới share được với admin-quanluong.*.
  if (host && d === host) {
    const parts = host.split(".");
    if (parts.length >= 3) {
      d = parts.slice(1).join(".");
    }
  }

  return `.${d}`;
}
