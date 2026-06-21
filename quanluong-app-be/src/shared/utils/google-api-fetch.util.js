import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { withGoogleApiRetry } from "./google-api-transport.util.js";

export function requireGoogleAccessToken(oauth2Client) {
  const token = String(oauth2Client?.credentials?.access_token ?? "").trim();
  if (!token) {
    throw new AppError({
      message: "Thiếu access token Google — làm mới OAuth trước khi gọi API.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  return token;
}

export function serializeGoogleQueryParams(params = {}, { excludeKeys = [] } = {}) {
  const skip = new Set(excludeKeys);
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || skip.has(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        sp.append(key, String(item));
      }
      continue;
    }
    sp.set(key, String(value));
  }
  return sp;
}

export function buildGoogleHttpError(apiLabel, status, payload) {
  const message =
    payload?.error?.message ||
    payload?.message ||
    `${apiLabel} trả về HTTP ${status}.`;
  const err = new Error(message);
  err.response = {
    status,
    data: payload?.error ? { error: payload.error } : payload,
  };
  return err;
}

export async function googleFetchJson(oauth2Client, url, { method = "GET", query, body, apiLabel = "Google API" } = {}) {
  const token = requireGoogleAccessToken(oauth2Client);
  const fullUrl = query?.toString() ? `${url}?${query}` : url;

  return withGoogleApiRetry(
    async () => {
      const res = await fetch(fullUrl, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let payload = {};
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          throw buildGoogleHttpError(apiLabel, res.status, {
            error: { message: `${apiLabel} trả về JSON không hợp lệ.` },
          });
        }
      }
      if (!res.ok) {
        throw buildGoogleHttpError(apiLabel, res.status, payload);
      }
      return payload;
    },
    { attempts: 5, delayMs: 600 },
  );
}
