import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { withGoogleApiRetry } from "./google-api-transport.util.js";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

function requireAccessToken(oauth2Client) {
  const token = String(oauth2Client?.credentials?.access_token ?? "").trim();
  if (!token) {
    throw new AppError({
      message: "Thiếu access token Google Drive — làm mới OAuth trước khi gọi API.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  return token;
}

function serializeQueryParams(params = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (key === "requestBody" || key === "fileId" || key === "media") continue;
    sp.set(key, String(value));
  }
  return sp;
}

function buildDriveHttpError(status, payload) {
  const message =
    payload?.error?.message ||
    payload?.message ||
    `Google Drive API trả về HTTP ${status}.`;
  const err = new Error(message);
  err.response = {
    status,
    data: payload?.error ? { error: payload.error } : payload,
  };
  return err;
}

async function driveFetchJson(oauth2Client, url, { method = "GET", query, body } = {}) {
  const token = requireAccessToken(oauth2Client);
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
          throw buildDriveHttpError(res.status, {
            error: { message: "Google Drive trả về JSON không hợp lệ." },
          });
        }
      }
      if (!res.ok) {
        throw buildDriveHttpError(res.status, payload);
      }
      return payload;
    },
    { attempts: 5, delayMs: 600 },
  );
}

/**
 * Drive v3 client qua fetch (tránh lỗi gaxios Premature close trong Docker).
 * API surface tương thích googleapis: `{ data }` cho list/get/create/update/copy.
 */
export function createDriveClient(oauth2Client) {
  return {
    files: {
      async list(params = {}) {
        const query = serializeQueryParams(params);
        const data = await driveFetchJson(oauth2Client, DRIVE_FILES_URL, { query });
        return { data };
      },
      async get(params = {}) {
        const { fileId, ...rest } = params;
        const query = serializeQueryParams(rest);
        const data = await driveFetchJson(
          oauth2Client,
          `${DRIVE_FILES_URL}/${encodeURIComponent(String(fileId))}`,
          { query },
        );
        return { data };
      },
      async create(params = {}) {
        const { requestBody, ...rest } = params;
        const query = serializeQueryParams(rest);
        const data = await driveFetchJson(oauth2Client, DRIVE_FILES_URL, {
          method: "POST",
          query,
          body: requestBody ?? {},
        });
        return { data };
      },
      async update(params = {}) {
        const { fileId, requestBody, ...rest } = params;
        const query = serializeQueryParams(rest);
        const data = await driveFetchJson(
          oauth2Client,
          `${DRIVE_FILES_URL}/${encodeURIComponent(String(fileId))}`,
          {
            method: "PATCH",
            query,
            body: requestBody ?? {},
          },
        );
        return { data };
      },
      async copy(params = {}) {
        const { fileId, requestBody, ...rest } = params;
        const query = serializeQueryParams(rest);
        const data = await driveFetchJson(
          oauth2Client,
          `${DRIVE_FILES_URL}/${encodeURIComponent(String(fileId))}/copy`,
          {
            method: "POST",
            query,
            body: requestBody ?? {},
          },
        );
        return { data };
      },
    },
  };
}
