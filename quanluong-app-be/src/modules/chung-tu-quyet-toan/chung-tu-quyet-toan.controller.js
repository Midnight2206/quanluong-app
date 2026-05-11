import { respondSuccess } from "../../shared/utils/responders.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  getChungTuQuyetToanHealth,
  getTemplateFillRules,
  importFileToGoogleWorkspace,
  listDriveTemplates,
  listSpreadsheetNamedRanges,
  putTemplateFillRules,
} from "./chung-tu-quyet-toan.service.js";
import {
  createTemplateCatalogFromUploadedOfficeFile,
  createTemplateCatalogLink,
  deleteTemplateCatalogLink,
  listTemplateCatalogForApp,
  listTemplateCatalogManage,
  patchTemplateCatalogLink,
} from "./chung-tu-template-catalog.service.js";
import { getContextFieldRegistryForCategory } from "./chung-tu-context-field-registry.js";

async function chungTuQuyetToanHealthController(req, res) {
  const data = await getChungTuQuyetToanHealth({
    user: req.user,
    unitScope: req.unitScope,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "ChungTuQuyetToan API is healthy",
    data,
  });
}

async function listDriveTemplatesController(req, res) {
  const data = await listDriveTemplates({ userId: req.user.id });
  return respondSuccess(res, {
    message: "Danh sách template từ thư mục mẫu trên Google Drive hệ thống (không phải Drive của từng user).",
    data,
  });
}

async function getTemplateFillRulesController(req, res) {
  const data = await getTemplateFillRules({
    userId: req.user.id,
    driveFileId: req.validatedParams.driveFileId,
  });
  return respondSuccess(res, {
    message: "Cấu hình điền dữ liệu cho template.",
    data,
  });
}

async function putTemplateFillRulesController(req, res) {
  const data = await putTemplateFillRules({
    userId: req.user.id,
    driveFileId: req.validatedParams.driveFileId,
    fillRules: req.validatedBody.fillRules,
    displayName: req.validatedBody.displayName,
  });
  return respondSuccess(res, {
    message: "Đã lưu cấu hình điền dữ liệu.",
    data,
  });
}

async function listSpreadsheetNamedRangesController(req, res) {
  const data = await listSpreadsheetNamedRanges({
    userId: req.user.id,
    driveFileId: req.validatedParams.driveFileId,
  });
  return respondSuccess(res, {
    message: "Danh sách Named ranges trên Google Sheets.",
    data,
  });
}

/** Superadmin: không cần quyền LTTP_ISSUE_SLIPS_READ — dùng trong màn thiết kế quy tắc điền. */
async function listSpreadsheetNamedRangesSuperadminController(req, res) {
  const data = await listSpreadsheetNamedRanges({
    userId: req.user.id,
    driveFileId: req.validatedParams.driveFileId,
  });
  return respondSuccess(res, {
    message: "Danh sách Named ranges (template hệ thống).",
    data,
  });
}

async function importDriveFileController(req, res) {
  if (!req.file?.buffer) {
    throw new AppError({
      message: "Thiếu file (multipart field «file»).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const targetFolder = req.validatedQuery.targetFolder ?? "template";
  const data = await importFileToGoogleWorkspace({
    userId: req.user.id,
    buffer: req.file.buffer,
    originalFilename: req.file.originalname,
    targetFolder,
    documentTitle: req.validatedBody.displayName,
  });
  return respondSuccess(res, {
    message: "Đã tải file lên Google Drive.",
    data,
  });
}

async function listTemplateCatalogController(req, res) {
  const { categoryKey } = req.validatedQuery;
  const items = await listTemplateCatalogForApp({ categoryKey });
  return respondSuccess(res, {
    message: "Danh sách mẫu chứng từ (Drive hệ thống — đăng ký bởi superadmin).",
    data: { items },
  });
}

async function listTemplateCatalogManageController(req, res) {
  const { categoryKey } = req.validatedQuery;
  const items = await listTemplateCatalogManage({ categoryKey });
  return respondSuccess(res, {
    message: "Danh sách đầy đủ để quản lý (bao gồm đã ẩn).",
    data: { items },
  });
}

async function templateCatalogFieldRegistryController(req, res) {
  const raw = req.validatedQuery.categoryKey;
  const categoryKey = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  const data = getContextFieldRegistryForCategory(categoryKey);
  return respondSuccess(res, {
    message: categoryKey
      ? "Gợi ý fieldKey và nguồn dữ liệu cho category."
      : "Truyền categoryKey (query) để xem gợi ý cụ thể.",
    data,
  });
}

async function createTemplateCatalogController(req, res) {
  const data = await createTemplateCatalogLink({
    categoryKey: req.validatedBody.categoryKey,
    displayName: req.validatedBody.displayName,
    linkUrl: req.validatedBody.linkUrl,
    sortOrder: req.validatedBody.sortOrder,
  });
  return respondSuccess(res, {
    message: "Đã thêm mẫu vào danh mục.",
    data,
  });
}

async function uploadTemplateCatalogOfficeController(req, res) {
  if (!req.file?.buffer) {
    throw new AppError({
      message: "Thiếu file (multipart field «file»).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const data = await createTemplateCatalogFromUploadedOfficeFile({
    categoryKey: req.validatedBody.categoryKey,
    displayName: req.validatedBody.displayName,
    sortOrder: req.validatedBody.sortOrder,
    buffer: req.file.buffer,
    originalFilename: req.file.originalname,
  });
  return respondSuccess(res, {
    message: "Đã tải Word/Excel lên Google Drive hệ thống và thêm vào danh mục.",
    data,
  });
}

async function patchTemplateCatalogController(req, res) {
  const data = await patchTemplateCatalogLink({
    id: req.validatedParams.id,
    displayName: req.validatedBody.displayName,
    linkUrl: req.validatedBody.linkUrl,
    sortOrder: req.validatedBody.sortOrder,
    isActive: req.validatedBody.isActive,
    fillRules: req.validatedBody.fillRules,
  });
  return respondSuccess(res, {
    message: "Đã cập nhật mẫu.",
    data,
  });
}

async function deleteTemplateCatalogController(req, res) {
  const data = await deleteTemplateCatalogLink({ id: req.validatedParams.id });
  return respondSuccess(res, {
    message: "Đã xóa mẫu khỏi danh mục.",
    data,
  });
}

export {
  chungTuQuyetToanHealthController,
  createTemplateCatalogController,
  deleteTemplateCatalogController,
  getTemplateFillRulesController,
  importDriveFileController,
  listDriveTemplatesController,
  listSpreadsheetNamedRangesController,
  listSpreadsheetNamedRangesSuperadminController,
  listTemplateCatalogController,
  listTemplateCatalogManageController,
  patchTemplateCatalogController,
  putTemplateFillRulesController,
  templateCatalogFieldRegistryController,
  uploadTemplateCatalogOfficeController,
};
