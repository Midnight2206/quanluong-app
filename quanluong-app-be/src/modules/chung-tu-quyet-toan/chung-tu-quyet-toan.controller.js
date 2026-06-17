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
import { listCategoryTemplates } from "./chung-tu-drive-folders.service.js";
import {
  checkDocumentStale,
  createOrGetChungTuDocument,
  buildChungTuDocumentPdf,
  deleteChungTuDocument,
  getChungTuDocumentByKey,
  listChungTuDocuments,
  previewChungTuContext,
  syncChungTuDocument,
} from "./chung-tu-document.service.js";
import { getChungTuUnitProfile, putChungTuUnitProfile } from "./chung-tu-unit-profile.service.js";
import {
  getCategoryTemplateFillMapping,
  putCategoryTemplateFillMapping,
} from "./chung-tu-template-fill-config.service.js";
import {
  createExcelTemplate,
  exportBkmhExcel,
  getExcelTemplateMetadata,
  listExcelExportHistory,
  listExcelTemplates,
  updateExcelTemplateMapping,
} from "./chung-tu-excel-template.service.js";

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

async function listCategoryTemplatesController(req, res) {
  const data = await listCategoryTemplates({
    categoryKey: req.validatedParams.categoryKey,
  });
  return respondSuccess(res, {
    message: "Danh sách mẫu trong thư mục Drive theo loại chứng từ.",
    data,
  });
}

async function getChungTuUnitProfileController(req, res) {
  const data = await getChungTuUnitProfile({
    unitId: req.validatedQuery.unitId,
  });
  return respondSuccess(res, {
    message: "Header/chữ ký mặc định theo đơn vị.",
    data,
  });
}

async function putChungTuUnitProfileController(req, res) {
  const { unitId, ...payload } = req.validatedBody;
  const data = await putChungTuUnitProfile({ unitId, payload });
  return respondSuccess(res, {
    message: "Đã lưu header/chữ ký theo đơn vị.",
    data,
  });
}

async function listChungTuDocumentsController(req, res) {
  const { unitId, categoryKey, from, to } = req.validatedQuery;
  const items = await listChungTuDocuments({
    unitId,
    categoryKey,
    from,
    to,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Danh sách chứng từ đã tạo.",
    data: { items },
  });
}

async function getChungTuDocumentController(req, res) {
  const data = await getChungTuDocumentByKey({
    documentKey: req.validatedParams.documentKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Chi tiết chứng từ.",
    data,
  });
}

async function deleteChungTuDocumentController(req, res) {
  const data = await deleteChungTuDocument({
    documentKey: req.validatedParams.documentKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Đã xóa chứng từ.",
    data,
  });
}

async function createChungTuDocumentController(req, res) {
  const body = req.validatedBody;
  const result = await createOrGetChungTuDocument({
    categoryKey: body.categoryKey,
    unitId: body.unitId,
    periodDate: body.periodDate,
    periodMonth: body.periodMonth,
    issueSlipId: body.issueSlipId,
    unitIds: body.unitIds,
    templateDriveFileId: body.templateDriveFileId,
    settings: body.settings ?? {},
    createdById: req.user.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: result.created
      ? "Đã tạo chứng từ Google Sheets và đồng bộ dữ liệu."
      : "Chứng từ đã tồn tại — mở bản hiện có.",
    data: result,
  });
}

async function syncChungTuDocumentController(req, res) {
  const data = await syncChungTuDocument({
    documentKey: req.validatedParams.documentKey,
    userId: req.user.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: data.wasStale ? "Đã đồng bộ lại (dữ liệu LTTP đã thay đổi)." : "Đã đồng bộ dữ liệu lên Google Sheets.",
    data,
  });
}

async function checkChungTuDocumentStaleController(req, res) {
  const data = await checkDocumentStale({
    documentKey: req.validatedParams.documentKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: data.stale ? "Dữ liệu LTTP đã thay đổi — nên đồng bộ lại." : "Chứng từ đang khớp dữ liệu LTTP.",
    data,
  });
}

async function printChungTuDocumentPdfController(req, res) {
  const data = await buildChungTuDocumentPdf({
    documentKey: req.validatedParams.documentKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${data.filename}"`);
  res.send(data.buffer);
}

async function previewChungTuContextController(req, res) {
  const body = req.validatedBody;
  const data = await previewChungTuContext({
    categoryKey: body.categoryKey,
    unitId: body.unitId,
    periodDate: body.periodDate,
    periodMonth: body.periodMonth,
    issueSlipId: body.issueSlipId,
    unitIds: body.unitIds,
    settings: body.settings ?? {},
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Xem trước dữ liệu nguồn từ LTTP.",
    data,
  });
}

async function listExcelTemplatesController(req, res) {
  const items = await listExcelTemplates({ categoryKey: req.validatedQuery.categoryKey });
  return respondSuccess(res, {
    message: "Danh sách template Excel local.",
    data: { items },
  });
}

async function uploadExcelTemplateController(req, res) {
  if (!req.file?.buffer) {
    throw new AppError({
      message: "Thiếu file Excel (multipart field «file»).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const data = await createExcelTemplate({
    categoryKey: req.validatedBody.categoryKey,
    displayName: req.validatedBody.displayName,
    buffer: req.file.buffer,
    originalFilename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    createdById: req.user.id,
  });
  return respondSuccess(res, {
    message: "Đã upload template Excel.",
    data,
  });
}

async function getExcelTemplateMetadataController(req, res) {
  const data = await getExcelTemplateMetadata({ id: req.validatedParams.id });
  return respondSuccess(res, {
    message: "Metadata template Excel.",
    data,
  });
}

async function putExcelTemplateMappingController(req, res) {
  const data = await updateExcelTemplateMapping({
    id: req.validatedParams.id,
    mapping: req.validatedBody.mapping,
    isActive: req.validatedBody.isActive,
  });
  return respondSuccess(res, {
    message: "Đã lưu mapping template Excel.",
    data,
  });
}

async function exportBkmhExcelController(req, res) {
  const body = req.validatedBody;
  const data = await exportBkmhExcel({
    templateId: body.templateId,
    unitId: body.unitId,
    periodMonth: body.periodMonth,
    unitIds: body.unitIds,
    settings: body.settings ?? {},
    createdById: req.user.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${data.filename}"`);
  res.send(data.buffer);
}

async function listExcelExportHistoryController(req, res) {
  const items = await listExcelExportHistory({ categoryKey: req.validatedQuery.categoryKey });
  return respondSuccess(res, {
    message: "Lịch sử xuất Excel.",
    data: { items },
  });
}

async function getCategoryTemplateFillMappingController(req, res) {
  const data = await getCategoryTemplateFillMapping({
    categoryKey: req.validatedParams.categoryKey,
    driveFileId: req.validatedParams.driveFileId,
  });
  return respondSuccess(res, {
    message: "Cấu hình map dữ liệu cho mẫu chứng từ.",
    data,
  });
}

async function putCategoryTemplateFillMappingController(req, res) {
  const data = await putCategoryTemplateFillMapping({
    categoryKey: req.validatedParams.categoryKey,
    driveFileId: req.validatedParams.driveFileId,
    fillRules: req.validatedBody.fillRules,
    updatedById: req.user?.id,
  });
  return respondSuccess(res, {
    message: "Đã lưu map dữ liệu cho mẫu chứng từ.",
    data,
  });
}

export {
  chungTuQuyetToanHealthController,
  checkChungTuDocumentStaleController,
  createChungTuDocumentController,
  deleteChungTuDocumentController,
  createTemplateCatalogController,
  deleteTemplateCatalogController,
  exportBkmhExcelController,
  getChungTuDocumentController,
  getExcelTemplateMetadataController,
  getCategoryTemplateFillMappingController,
  getChungTuUnitProfileController,
  getTemplateFillRulesController,
  importDriveFileController,
  listCategoryTemplatesController,
  listChungTuDocumentsController,
  listDriveTemplatesController,
  listExcelExportHistoryController,
  listExcelTemplatesController,
  listSpreadsheetNamedRangesController,
  listSpreadsheetNamedRangesSuperadminController,
  listTemplateCatalogController,
  listTemplateCatalogManageController,
  patchTemplateCatalogController,
  printChungTuDocumentPdfController,
  previewChungTuContextController,
  putCategoryTemplateFillMappingController,
  putChungTuUnitProfileController,
  putExcelTemplateMappingController,
  putTemplateFillRulesController,
  syncChungTuDocumentController,
  templateCatalogFieldRegistryController,
  uploadExcelTemplateController,
  uploadTemplateCatalogOfficeController,
};
