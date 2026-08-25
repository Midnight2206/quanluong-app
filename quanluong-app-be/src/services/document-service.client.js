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

async function requestDocument(path, options = {}) {
  assertConfigured();
  try {
    const response = await fetch(new URL(path, config.documentService.url), {
      ...options,
      headers: {
        "X-Service-Key": config.documentService.key,
        ...(options.headers ?? {}),
      },
      signal: AbortSignal.timeout(config.documentService.timeoutMs),
    });
    if (!response.ok) {
      const isBadRequest = response.status === 400;
      const isConflict = response.status === 409;
      const isNotFound = response.status === 404;
      const isAuthFailure = response.status === 401 || response.status === 403;
      throw new AppError({
        message: isAuthFailure
          ? "Document service xác thực nội bộ thất bại"
          : await readErrorMessage(response),
        statusCode: isBadRequest ? 400 : isNotFound ? 404 : isConflict ? 409 : 502,
        code: isBadRequest
          ? ERROR_CODES.VALIDATION_ERROR
          : isNotFound
            ? ERROR_CODES.NOT_FOUND
            : isConflict
              ? ERROR_CODES.CONFLICT
            : ERROR_CODES.INTERNAL_SERVER_ERROR,
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

async function readJsonResponse(response) {
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

async function listTemplates() {
  const response = await requestDocument("/v1/templates");
  return readJsonResponse(response);
}

async function getTemplate(templateId) {
  const response = await requestDocument(`/v1/templates/${templateId}`);
  return readJsonResponse(response);
}

async function previewTemplatePdf(templateId) {
  const response = await requestDocument(`/v1/templates/${templateId}/preview`);
  return Buffer.from(await response.arrayBuffer());
}

async function getTemplateFields(templateId) {
  const response = await requestDocument(`/v1/templates/${templateId}/fields`);
  return readJsonResponse(response);
}

async function uploadTemplate({ buffer, name, version }) {
  const form = new FormData();
  form.append("file", new Blob([buffer]), "template.xlsx");
  form.append("name", name);
  form.append("version", version);
  const response = await requestDocument("/v1/templates", {
    method: "POST",
    body: form,
  });
  return readJsonResponse(response);
}

async function publishTemplate(templateId) {
  const response = await requestDocument(`/v1/templates/${templateId}/publish`, {
    method: "POST",
  });
  return readJsonResponse(response);
}

async function retireTemplate(templateId) {
  const response = await requestDocument(`/v1/templates/${templateId}/retire`, {
    method: "POST",
  });
  return readJsonResponse(response);
}

async function renderDocumentPdf(templateId, body = {}) {
  const {
    fields = {},
    rows = [],
    signatures = {},
    signature_dates = {},
    signature_block,
  } = body;
  const payload = { fields, rows, signatures, signature_dates };
  if (signature_block) payload.signature_block = signature_block;
  const response = await requestDocument(`/v1/templates/${templateId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

async function seedBienBanTestV2Demo() {
  const response = await requestDocument("/v1/demo-documents/bien-ban-test-v2", {
    method: "POST",
  });
  return readJsonResponse(response);
}

async function getDocument(documentId) {
  const response = await requestDocument(`/v1/documents/${documentId}`);
  return readJsonResponse(response);
}

async function renderStoredDocumentPdf(documentId, body = {}) {
  const payload = {
    signatures: body.signatures ?? {},
    signature_dates: body.signature_dates ?? {},
  };
  if (body.signature_block) payload.signature_block = body.signature_block;
  const response = await requestDocument(`/v1/documents/${documentId}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

async function seedDemoForTemplate(templateId) {
  const response = await requestDocument(`/v1/demo-documents/template/${templateId}`, {
    method: "POST",
  });
  return readJsonResponse(response);
}

async function createDocumentFolder({ name }) {
  const response = await requestDocument("/v1/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return readJsonResponse(response);
}

async function getDocumentFolder(folderId) {
  const response = await requestDocument(`/v1/folders/${folderId}`);
  return readJsonResponse(response);
}

async function renderToDocumentFolder(folderId, body = {}) {
  const {
    templateId,
    fileName,
    sortKey,
    fields = {},
    rows = [],
    signatures = {},
    signatureDates = {},
    signatureBlock,
  } = body;
  const payload = {
    template_id: templateId,
    file_name: fileName,
    fields,
    rows,
    signatures,
    signature_dates: signatureDates,
  };
  if (sortKey != null) payload.sort_key = sortKey;
  if (signatureBlock) payload.signature_block = signatureBlock;
  const response = await requestDocument(`/v1/folders/${folderId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(response);
}

async function streamDocumentFolderFile(folderId, fileId) {
  return requestDocument(`/v1/folders/${folderId}/files/${fileId}`);
}

async function streamDocumentFolderZip(folderId) {
  return requestDocument(`/v1/folders/${folderId}/zip`);
}

async function streamDocumentFolderMergedPdf(folderId) {
  return requestDocument(`/v1/folders/${folderId}/merged.pdf`);
}

async function deleteDocumentFolder(folderId) {
  const response = await requestDocument(`/v1/folders/${folderId}`, {
    method: "DELETE",
  });
  return readJsonResponse(response);
}

export {
  createDocumentFolder,
  deleteDocumentFolder,
  exportWorkbook,
  getDocument,
  getDocumentFolder,
  getTemplate,
  getTemplateFields,
  isDocumentServiceConfigured,
  listTemplates,
  parseWorkbook,
  planPagination,
  previewTemplatePdf,
  publishTemplate,
  renderDocumentPdf,
  renderStoredDocumentPdf,
  renderToDocumentFolder,
  retireTemplate,
  seedBienBanTestV2Demo,
  seedDemoForTemplate,
  streamDocumentFolderFile,
  streamDocumentFolderMergedPdf,
  streamDocumentFolderZip,
  uploadTemplate,
};
