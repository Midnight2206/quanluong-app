/**
 * Biến `NEXT_PUBLIC_*` phải đọc bằng `process.env.TÊN_CỐ_ĐỊNH` (không dùng `process.env[key]`).
 * Next.js chỉ inline khi tên key là chuỗi literal; nếu không, client bundle mất giá trị → fallback `/api`
 * và mọi request axios đập vào Next (404) thay vì backend.
 */
export function isDevRuntime() {
  return process.env.NODE_ENV === "development";
}

export function getApiBaseUrl() {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL;
  return v && String(v).trim() !== "" ? String(v).replace(/\/+$/, "") : "/api";
}

/**
 * Origin cho Socket.io (không có `/api`).
 * 1) `NEXT_PUBLIC_SOCKET_BASE_URL`
 * 2) `NEXT_PUBLIC_SOCKET_PORT` + hostname trình duyệt (luồng socket riêng cổng, cùng host)
 * 3) suy ra từ `NEXT_PUBLIC_API_BASE_URL` (bỏ `/api`)
 * 4) `/api` tương đối → `window.location.origin` (cần proxy `/socket.io`)
 */
export function getChatSocketBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }
  const explicit = process.env.NEXT_PUBLIC_SOCKET_BASE_URL;
  if (explicit && String(explicit).trim() !== "") {
    return String(explicit).trim().replace(/\/+$/, "");
  }
  const socketPort = process.env.NEXT_PUBLIC_SOCKET_PORT;
  if (socketPort && String(socketPort).trim() !== "") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${String(socketPort).trim()}`;
  }
  const api = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!api || String(api).trim() === "" || String(api).trim() === "/api") {
    return window.location.origin;
  }
  const t = String(api).trim().replace(/\/+$/, "");
  if (t.endsWith("/api")) {
    return t.slice(0, -4);
  }
  return t;
}

/**
 * Origin phục vụ file tĩnh `/media/...` (avatar Express.static trên API, không nằm dưới `/api`).
 * - Dev Docker: suy ra từ `NEXT_PUBLIC_API_BASE_URL` (bỏ hậu tố `/api`) → `http://localhost:3000`.
 * - Prod cùng host (Nginx `/media` + `/api`): để trống → ảnh vẫn dùng đường dẫn tương đối `/media/...` đúng origin UI.
 * Ghi đè: `NEXT_PUBLIC_MEDIA_PUBLIC_ORIGIN`.
 */
export function getMediaPublicOrigin() {
  const explicit = process.env.NEXT_PUBLIC_MEDIA_PUBLIC_ORIGIN;
  if (explicit && String(explicit).trim() !== "") {
    return String(explicit).trim().replace(/\/+$/, "");
  }
  const api = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!api || String(api).trim() === "") {
    return "";
  }
  const t = String(api).trim().replace(/\/+$/, "");
  if (t.endsWith("/api")) {
    return t.slice(0, -4);
  }
  return "";
}

/** Chuẩn hoá URL avatar/media: path `/media/...` → absolute khi API khác origin với UI. */
export function resolveMediaUrl(pathOrUrl) {
  if (pathOrUrl == null || pathOrUrl === "") {
    return pathOrUrl;
  }
  const s = String(pathOrUrl);
  if (/^(https?:|data:|blob:)/i.test(s)) {
    return s;
  }
  if (!s.startsWith("/")) {
    return s;
  }
  const origin = getMediaPublicOrigin();
  if (!origin) {
    return s;
  }
  return `${origin}${s}`;
}

export function getSuperadminOriginEnv() {
  const v = process.env.NEXT_PUBLIC_SUPERADMIN_ORIGIN;
  return v && String(v).trim() !== "" ? v : undefined;
}

export function getMainAppOriginEnv() {
  const v = process.env.NEXT_PUBLIC_MAIN_APP_ORIGIN;
  return v && String(v).trim() !== "" ? v : undefined;
}
