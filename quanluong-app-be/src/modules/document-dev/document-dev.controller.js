import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  getDocument,
  getTemplate,
  getTemplateFields,
  isDocumentServiceConfigured,
  listTemplates,
  renderDocumentPdf,
  renderStoredDocumentPdf,
  seedBienBanTestV2Demo,
  seedDemoForTemplate,
  uploadTemplate,
} from "../../services/document-service.client.js";
import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";

async function documentDevHealthController(_req, res) {
  return respondSuccess(res, {
    message: "Document dev proxy OK",
    data: { configured: isDocumentServiceConfigured() },
  });
}

async function listDocumentTemplatesController(_req, res) {
  const templates = await listTemplates();
  return respondSuccess(res, {
    message: "Đã tải danh sách mẫu",
    data: { templates },
  });
}

async function getDocumentTemplateController(req, res) {
  const template = await getTemplate(req.validatedParams.id);
  return respondSuccess(res, {
    message: "Đã tải mẫu",
    data: { template },
  });
}

async function getDocumentTemplateFieldsController(req, res) {
  const schema = await getTemplateFields(req.validatedParams.id);
  return respondSuccess(res, {
    message: "Đã tải schema mẫu",
    data: schema,
  });
}

async function uploadDocumentTemplateController(req, res) {
  if (!req.file?.buffer) {
    throw new AppError({
      message: "Thiếu file .xlsx",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const name = String(req.body?.name || "").trim();
  const version = String(req.body?.version || "").trim();
  if (!name || !version) {
    throw new AppError({
      message: "Thiếu tên hoặc phiên bản mẫu",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const template = await uploadTemplate({
    buffer: req.file.buffer,
    name,
    version,
  });
  return respondCreated(res, {
    message: "Đã import mẫu",
    data: { template },
  });
}

async function renderDocumentPdfController(req, res) {
  const pdfBuffer = await renderDocumentPdf(req.validatedParams.id, req.validatedBody);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="document-dev.pdf"');
  return res.send(pdfBuffer);
}

async function renderStoredDocumentPdfController(req, res) {
  const pdfBuffer = await renderStoredDocumentPdf(req.validatedParams.id, req.validatedBody ?? {});
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="document-dev.pdf"');
  return res.send(pdfBuffer);
}

async function seedBienBanTestV2DemoController(_req, res) {
  const document = await seedBienBanTestV2Demo();
  return respondSuccess(res, {
    message: "Đã tạo dữ liệu demo bien_ban_test v2 trong DB",
    data: { document },
  });
}

async function getDocumentController(req, res) {
  const document = await getDocument(req.validatedParams.id);
  return respondSuccess(res, {
    message: "Đã tải dữ liệu chứng từ",
    data: { document },
  });
}

async function seedDemoForTemplateController(req, res) {
  const document = await seedDemoForTemplate(req.validatedParams.id);
  return respondSuccess(res, {
    message: "Đã tạo dữ liệu demo trong DB",
    data: { document },
  });
}

export {
  documentDevHealthController,
  getDocumentController,
  getDocumentTemplateController,
  getDocumentTemplateFieldsController,
  listDocumentTemplatesController,
  renderDocumentPdfController,
  renderStoredDocumentPdfController,
  seedBienBanTestV2DemoController,
  seedDemoForTemplateController,
  uploadDocumentTemplateController,
};
