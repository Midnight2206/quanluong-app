import { resolveMediaUrl } from "@/utils/runtimeEnv";

/** Ảnh mặc định khi user chưa có avatar (đặt trong `public/images/` của app Next). */
export const DEFAULT_AVATAR_URL = "/images/avatar-placeholder.svg";

/**
 * @param {string | null | undefined} pathOrUrl profile.avatarUrl hoặc URL đã resolve
 * @returns {string} Luôn trả về URL hiển thị được (placeholder nếu trống)
 */
export function resolveAvatarUrl(pathOrUrl) {
  if (pathOrUrl == null || String(pathOrUrl).trim() === "") {
    return DEFAULT_AVATAR_URL;
  }
  const s = String(pathOrUrl).trim();
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:") || s.startsWith("/")) {
    if (s.startsWith("/images/")) {
      return s;
    }
    return resolveMediaUrl(s);
  }
  return resolveMediaUrl(s);
}
