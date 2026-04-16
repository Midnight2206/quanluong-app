import "server-only";

import { cookies } from "next/headers";
import { TARGET_UNIT_COOKIE_NAME } from "@/constants/targetUnitCookie";
import { getApiBaseUrl } from "@/utils/runtimeEnv";

function resolveServerApiBaseUrl() {
  const base = getApiBaseUrl();
  if (/^https?:\/\//i.test(base)) {
    return base.replace(/\/$/, "");
  }
  const internal = typeof process !== "undefined" ? process.env.API_BASE_URL_INTERNAL : undefined;
  if (internal && /^https?:\/\//i.test(String(internal))) {
    return String(internal).replace(/\/$/, "");
  }
  return null;
}

/**
 * fetch tới backend từ Server Component / server-only: forward cookie phiên + optional X-Target-Unit-Id (cookie đồng bộ từ client).
 * Cần URL tuyệt đối: đặt NEXT_PUBLIC_API_BASE_URL=http://host:port/api hoặc API_BASE_URL_INTERNAL.
 *
 * @param {string} path ví dụ `/users`
 * @param {RequestInit & { skipTargetUnitHeader?: boolean, forwardCookies?: boolean }} init
 * @param init.forwardCookies Mặc định true (API cần phiên). Đặt false cho endpoint công khai để không gọi `cookies()` (trang có thể static/ISR).
 */
export async function serverApiFetch(path, init = {}) {
  const {
    skipTargetUnitHeader = false,
    forwardCookies = true,
    headers: extraHeaders,
    ...fetchInit
  } = init;
  const baseUrl = resolveServerApiBaseUrl();
  if (!baseUrl) {
    return new Response(null, { status: 503, statusText: "API base URL not configured for server fetch" });
  }
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(extraHeaders);

  if (forwardCookies) {
    const cookieStore = await cookies();
    const cookiePairs = cookieStore
      .getAll()
      .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
      .join("; ");
    if (cookiePairs) {
      headers.set("Cookie", cookiePairs);
    }
    if (!skipTargetUnitHeader) {
      const raw = cookieStore.get(TARGET_UNIT_COOKIE_NAME)?.value;
      if (raw != null && raw !== "" && /^\d+$/.test(String(raw))) {
        headers.set("X-Target-Unit-Id", String(raw));
      }
    }
  }

  const method = (fetchInit.method || "GET").toUpperCase();
  let body = fetchInit.body;
  if (
    body != null &&
    method !== "GET" &&
    method !== "HEAD" &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob)
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const { cache: cacheOpt, ...restFetch } = fetchInit;

  return fetch(url, {
    ...restFetch,
    method,
    headers,
    body,
    cache: cacheOpt ?? "no-store",
  });
}
