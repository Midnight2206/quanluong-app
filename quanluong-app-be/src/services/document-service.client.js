import { config } from "../config/config.js";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";

function isDocumentServiceConfigured() {
  return Boolean(config.documentService.url);
}

function assertConfigured() {
  if (!isDocumentServiceConfigured()) {
    throw new AppError({
      message: "Document service chưa cấu hình (DOCUMENT_SERVICE_URL)",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

async function readErrorMessage(response) {
  const body = await response.json().catch(() => null);
  return body?.error?.message || `Document service lỗi HTTP ${response.status}`;
}

async function requestDocument(path, options) {
  assertConfigured();
  try {
    const response = await fetch(new URL(path, config.documentService.url), {
      ...options,
      headers: {
        "X-Service-Key": config.documentService.key,
        ...options.headers,
      },
      signal: AbortSignal.timeout(config.documentService.timeoutMs),
    });
    if (!response.ok) {
      const isBadRequest = response.status === 400;
      const isAuthFailure = response.status === 401 || response.status === 403;
      throw new AppError({
        message: isAuthFailure
          ? "Document service xác thực nội bộ thất bại"
          : await readErrorMessage(response),
        statusCode: isBadRequest ? 400 : 502,
        code: isBadRequest ? ERROR_CODES.VALIDATION_ERROR : ERROR_CODES.INTERNAL_SERVER_ERROR,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError({
      message: "Không thể kết nối Document service",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      details: { cause: error?.message },
    });
  }
}

async function parseWorkbook(buffer, { sheet } = {}) {
  const url = new URL("/v1/parse", config.documentService.url || "http://document.invalid");
  if (sheet) {
    url.searchParams.set("sheet", sheet);
  }
  const form = new FormData();
  form.append("file", new Blob([buffer]), "upload.xlsx");
  const response = await requestDocument(`${url.pathname}${url.search}`, {
    method: "POST",
    body: form,
  });
  try {
    return await response.json();
  } catch {
    throw new AppError({
      message: "Document service trả về dữ liệu không hợp lệ",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

async function exportWorkbook({ sheet, rows }) {
  const response = await requestDocument("/v1/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(sheet ? { sheet } : {}), rows }),
  });
  try {
    return Buffer.from(await response.arrayBuffer());
  } catch {
    throw new AppError({
      message: "Document service trả về dữ liệu không hợp lệ",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

async function planPagination(body) {
  const response = await requestDocument("/v1/pagination/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  try {
    return await response.json();
  } catch {
    throw new AppError({
      message: "Document service trả về dữ liệu không hợp lệ",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

export { exportWorkbook, isDocumentServiceConfigured, parseWorkbook, planPagination };
