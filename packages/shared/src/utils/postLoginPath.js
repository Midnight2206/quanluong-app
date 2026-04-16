/**
 * Tránh open redirect sau đăng nhập (chỉ cho phép đường dẫn nội bộ).
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function safeInternalPath(raw) {
  if (raw == null || typeof raw !== "string") {
    return "/";
  }
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) {
    return "/";
  }
  return t;
}
