import httpClient from "@/services/httpClient";

function parseRetryAfter(headers) {
  if (!headers) {
    return undefined;
  }
  const raRaw = headers["retry-after"] ?? headers["Retry-After"];
  if (raRaw == null || raRaw === "") {
    return undefined;
  }
  const n = Number.parseInt(String(raRaw), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Gọi API giống RTK baseQuery: trả về `response.data` (envelope JSON), transform giống `transformResponse: (r) => r.data`.
 */
export async function apiRequest({
  url,
  method = "get",
  data,
  params,
  skipTargetUnitHeader,
  meta,
} = {}) {
  const skip = Boolean(skipTargetUnitHeader || meta?.skipTargetUnitHeader);
  try {
    const result = await httpClient({
      url,
      method,
      data,
      params,
      skipTargetUnitHeader: skip,
    });
    const body = result.data;
    if (body && typeof body === "object" && "data" in body) {
      return body.data;
    }
    return body;
  } catch (error) {
    const hdr = error.response?.headers;
    const retryAfterSec = parseRetryAfter(hdr);
    const err = {
      status: error.response?.status,
      data: error.response?.data || error.message,
      ...(Number.isFinite(retryAfterSec) ? { retryAfterSec } : {}),
    };
    throw err;
  }
}

/** Promise có `.unwrap()` tương thích RTK mutation trigger. */
export function withUnwrap(promise) {
  const p = Promise.resolve(promise);
  p.unwrap = () => p;
  return p;
}
