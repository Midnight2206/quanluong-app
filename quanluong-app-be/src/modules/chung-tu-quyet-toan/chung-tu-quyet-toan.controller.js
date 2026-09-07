import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
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
import { seedUserTemplatesFromSystem } from "./chung-tu-template-seed.service.js";
import {
  listTemplateFolderBrowse,
  resolveTemplateSelectionMeta,
} from "./chung-tu-template-tree.service.js";
import {
  checkDocumentStale,
  createOrGetChungTuDocument,
  deleteChungTuDocument,
  getChungTuDocumentByKey,
  listChungTuDocuments,
  previewChungTuContext,
  syncChungTuDocument,
  listBkmhSnapshotsByDocumentKey,
} from "./chung-tu-document.service.js";
import {
  createChungTuPdfExport,
  deleteChungTuPdfExport,
  getChungTuPdfExportFile,
  listChungTuPdfExports,
} from "./chung-tu-pdf-export.service.js";
import {
  createChungTuPdfExportBatch,
  deleteChungTuPdfExportBatch,
  getChungTuPdfExportBatch,
  listChungTuPdfExportBatches,
  streamChungTuPdfExportBatchFile,
  streamChungTuPdfExportBatchMergedPdf,
  streamChungTuPdfExportBatchZip,
} from "./chung-tu-pdf-export-batch.service.js";
import {
  createChungTuBkmhMonthlyExport,
  deleteChungTuBkmhMonthly,
  exportChungTuBkmhMonthlySummaryExcel,
  getChungTuBkmhMonthly,
  listChungTuBkmhMonthly,
  streamChungTuBkmhMonthlyMergedPdf,
  streamChungTuBkmhMonthlySliceFile,
  streamChungTuBkmhMonthlyZip,
} from "./chung-tu-bkmh-monthly.service.js";
import { getChungTuUnitProfile, putChungTuUnitProfile } from "./chung-tu-unit-profile.service.js";
import {
  getCategoryTemplateFillMapping,
  putCategoryTemplateFillMapping,
} from "./chung-tu-template-fill-config.service.js";
import {
  createChungTuPdfTemplate,
  getChungTuPdfTemplateFields,
  listChungTuPdfTemplates,
  previewChungTuPdfTemplate,
  publishChungTuPdfTemplate,
  retireChungTuPdfTemplate,
  updateChungTuPdfTemplateFieldLabels,
} from "./chung-tu-pdf-template.service.js";
import {
  getChungTuSignatureSettings,
  upsertChungTuSignatureSettings,
} from "./chung-tu-signature-settings.service.js";
import {
  getChungTuBkmhHeaderSettings,
  upsertChungTuBkmhHeaderSettings,
} from "./chung-tu-bkmh-header-settings.service.js";
import { getChungTuPdfFieldCatalog } from "./chung-tu-pdf-field-catalog.js";

async function pipeDocumentServiceResponse(res, upstreamResponse, fallbackContentType) {
  const contentType = upstreamResponse.headers.get("content-type") || fallbackContentType;
  const contentDisposition = upstreamResponse.headers.get("content-disposition");
  const contentLength = upstreamResponse.headers.get("content-length");
  if (contentType) res.setHeader("Content-Type", contentType);
  if (contentDisposition) res.setHeader("Content-Disposition", contentDisposition);
  if (contentLength) res.setHeader("Content-Length", contentLength);
  if (!upstreamResponse.body) {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(upstreamResponse.body), res);
}

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
    message: "Danh sách Named ranges (template trên Drive đã liên kết).",
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
    message: "Danh sách mẫu chứng từ (Drive đã liên kết).",
    data: { items },
  });
}

function isSuperadminUser(user) {
  return user?.type?.name === "superadmin";
}

async function listChungTuPdfTemplatesController(req, res) {
  const wantNonPublished = Boolean(req.validatedQuery.includeNonPublished);
  const includeNonPublished = wantNonPublished && isSuperadminUser(req.user);
  const items = await listChungTuPdfTemplates({
    categoryKey: req.validatedQuery.categoryKey,
    includeNonPublished,
  });
  return respondSuccess(res, {
    message: "Danh sách mẫu PDF chứng từ.",
    data: { items },
  });
}

async function createChungTuPdfTemplateController(req, res) {
  if (!req.file?.buffer) {
    throw new AppError({
      message: "Thiếu file (multipart field «file»).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const data = await createChungTuPdfTemplate({
    categoryKey: req.validatedBody.categoryKey,
    displayName: req.validatedBody.displayName,
    name: req.validatedBody.name,
    version: req.validatedBody.version,
    buffer: req.file.buffer,
    uploadedById: req.user.id,
  });
  return respondCreated(res, {
    message: "Đã tải mẫu PDF lên Document service.",
    data,
  });
}

async function listChungTuPdfExportsController(req, res) {
  const { unitId, categoryKey, from, to } = req.validatedQuery;
  const items = await listChungTuPdfExports({
    unitId,
    categoryKey,
    from,
    to,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Danh sách lịch sử xuất PDF.",
    data: { items },
  });
}

async function createChungTuPdfExportController(req, res) {
  const body = req.validatedBody;
  const data = await createChungTuPdfExport({
    categoryKey: body.categoryKey,
    unitId: body.unitId,
    periodDate: body.periodDate,
    periodMonth: body.periodMonth,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    issueSlipId: body.issueSlipId,
    unitIds: body.unitIds,
    aggregationMode: body.aggregationMode,
    pdfTemplateId: body.pdfTemplateId,
    signatures: body.signatures,
    signatureDates: body.signatureDates,
    signatureBlock: body.signatureBlock,
    settings: body.settings ?? {},
    exportingUserProfile: req.user?.profile ?? null,
    createdById: req.user.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondCreated(res, {
    message: "Đã xuất PDF chứng từ.",
    data,
  });
}

async function listChungTuPdfExportBatchesController(req, res) {
  const { unitId, categoryKey } = req.validatedQuery;
  const items = await listChungTuPdfExportBatches({
    unitId,
    categoryKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Danh sách lô xuất PDF.",
    data: { items },
  });
}

async function getChungTuPdfExportBatchController(req, res) {
  const data = await getChungTuPdfExportBatch({
    batchKey: req.validatedParams.batchKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Chi tiết lô xuất PDF.",
    data,
  });
}

async function createChungTuPdfExportBatchController(req, res) {
  const body = req.validatedBody;
  const data = await createChungTuPdfExportBatch({
    categoryKey: body.categoryKey,
    unitId: body.unitId,
    periodDate: body.periodDate,
    periodMonth: body.periodMonth,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    issueSlipId: body.issueSlipId,
    unitIds: body.unitIds,
    aggregationMode: body.aggregationMode,
    pdfTemplateId: body.pdfTemplateId,
    signatures: body.signatures,
    signatureDates: body.signatureDates,
    signatureBlock: body.signatureBlock,
    settings: body.settings ?? {},
    exportingUserProfile: req.user?.profile ?? null,
    createdById: req.user.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondCreated(res, {
    message: "Đã tạo lô xuất PDF.",
    data,
  });
}

async function streamChungTuPdfExportBatchZipController(req, res) {
  const upstream = await streamChungTuPdfExportBatchZip({
    batchKey: req.validatedParams.batchKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  await pipeDocumentServiceResponse(res, upstream, "application/zip");
}

async function streamChungTuPdfExportBatchMergedPdfController(req, res) {
  const upstream = await streamChungTuPdfExportBatchMergedPdf({
    batchKey: req.validatedParams.batchKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  await pipeDocumentServiceResponse(res, upstream, "application/pdf");
}

async function streamChungTuPdfExportBatchFileController(req, res) {
  const upstream = await streamChungTuPdfExportBatchFile({
    batchKey: req.validatedParams.batchKey,
    fileId: req.validatedParams.fileId,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  await pipeDocumentServiceResponse(res, upstream, "application/pdf");
}

async function deleteChungTuPdfExportBatchController(req, res) {
  const data = await deleteChungTuPdfExportBatch({
    batchKey: req.validatedParams.batchKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Đã xóa lô xuất PDF.",
    data,
  });
}

async function listChungTuBkmhMonthlyController(req, res) {
  const items = await listChungTuBkmhMonthly({
    storageUnitId: req.validatedQuery.storageUnitId,
    periodMonth: req.validatedQuery.periodMonth,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Danh sách BKMH tháng.",
    data: { items },
  });
}

async function exportChungTuBkmhMonthlyExcelController(req, res) {
  const { buffer, fileName } = await exportChungTuBkmhMonthlySummaryExcel({
    id: req.validatedParams.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${String(fileName).replaceAll('"', "")}"`,
  );
  return res.send(buffer);
}

async function createChungTuBkmhMonthlyController(req, res) {
  const body = req.validatedBody;
  const data = await createChungTuBkmhMonthlyExport({
    storageUnitId: body.unitId,
    periodMonth: body.periodMonth,
    unitIds: body.unitIds,
    aggregationMode: body.aggregationMode,
    pdfTemplateId: body.pdfTemplateId,
    signatures: body.signatures,
    signatureDates: body.signatureDates,
    signatureBlock: body.signatureBlock,
    settings: req.chungTuSettings ?? body.settings ?? {},
    exportingUserProfile: req.userProfile ?? req.user?.profile ?? null,
    createdById: req.user.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondCreated(res, {
    message: "Đã xuất BKMH tháng.",
    data,
  });
}

async function getChungTuBkmhMonthlyController(req, res) {
  const data = await getChungTuBkmhMonthly({
    id: req.validatedParams.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Chi tiết BKMH tháng.",
    data,
  });
}

async function streamChungTuBkmhMonthlyZipController(req, res) {
  const upstream = await streamChungTuBkmhMonthlyZip({
    id: req.validatedParams.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  await pipeDocumentServiceResponse(res, upstream, "application/zip");
}

async function streamChungTuBkmhMonthlyMergedPdfController(req, res) {
  const upstream = await streamChungTuBkmhMonthlyMergedPdf({
    id: req.validatedParams.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  await pipeDocumentServiceResponse(res, upstream, "application/pdf");
}

async function streamChungTuBkmhMonthlySliceFileController(req, res) {
  const upstream = await streamChungTuBkmhMonthlySliceFile({
    id: req.validatedParams.id,
    sliceId: req.validatedParams.sliceId,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  await pipeDocumentServiceResponse(res, upstream, "application/pdf");
}

async function deleteChungTuBkmhMonthlyController(req, res) {
  const data = await deleteChungTuBkmhMonthly({
    id: req.validatedParams.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Đã xóa BKMH tháng.",
    data,
  });
}

async function getChungTuPdfExportFileController(req, res) {
  const { buffer, fileName } = await getChungTuPdfExportFile({
    exportKey: req.validatedParams.exportKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"${fileName.replaceAll("\"", "")}\"`);
  return res.send(buffer);
}

async function deleteChungTuPdfExportController(req, res) {
  const data = await deleteChungTuPdfExport({
    exportKey: req.validatedParams.exportKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Đã xóa bản xuất PDF.",
    data,
  });
}

async function publishChungTuPdfTemplateController(req, res) {
  const data = await publishChungTuPdfTemplate({
    id: req.validatedParams.id,
  });
  return respondSuccess(res, {
    message: "Đã publish mẫu PDF.",
    data,
  });
}

async function retireChungTuPdfTemplateController(req, res) {
  const data = await retireChungTuPdfTemplate({
    id: req.validatedParams.id,
  });
  return respondSuccess(res, {
    message: "Đã retire mẫu PDF.",
    data,
  });
}

async function putChungTuPdfTemplateFieldLabelsController(req, res) {
  const data = await updateChungTuPdfTemplateFieldLabels({
    id: req.validatedParams.id,
    fieldLabels: req.validatedBody.fieldLabels,
  });
  return respondSuccess(res, {
    message: "Đã lưu nhãn field của mẫu PDF.",
    data,
  });
}

async function getChungTuPdfTemplateFieldsController(req, res) {
  const data = await getChungTuPdfTemplateFields({
    id: req.validatedParams.id,
    allowNonPublished: isSuperadminUser(req.user),
  });
  return respondSuccess(res, {
    message: "Schema mẫu PDF.",
    data,
  });
}

async function previewChungTuPdfTemplateController(req, res) {
  const { upstreamResponse, fallbackContentDisposition } = await previewChungTuPdfTemplate({
    id: req.validatedParams.id,
  });
  if (!upstreamResponse.headers.get("content-disposition")) {
    res.setHeader("Content-Disposition", fallbackContentDisposition);
  }
  await pipeDocumentServiceResponse(res, upstreamResponse, "application/pdf");
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
    userId: req.user.id,
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
    userId: req.user.id,
    categoryKey: req.validatedBody.categoryKey,
    displayName: req.validatedBody.displayName,
    sortOrder: req.validatedBody.sortOrder,
    buffer: req.file.buffer,
    originalFilename: req.file.originalname,
  });
  return respondSuccess(res, {
    message: "Đã tải Word/Excel lên Google Drive và thêm vào danh mục.",
    data,
  });
}

async function patchTemplateCatalogController(req, res) {
  const data = await patchTemplateCatalogLink({
    userId: req.user.id,
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

async function listTemplateTreeController(req, res) {
  const data = await listTemplateFolderBrowse({
    userId: req.user.id,
    folderId: req.validatedQuery.folderId,
    categoryKey: req.validatedQuery.categoryKey,
  });
  return respondSuccess(res, {
    message: "Duyệt thư mục mẫu chứng từ trên Drive.",
    data,
  });
}

async function getTemplateTreeFileMetaController(req, res) {
  const data = await resolveTemplateSelectionMeta({
    userId: req.user.id,
    driveFileId: req.validatedParams.driveFileId,
  });
  return respondSuccess(res, {
    message: "Metadata mẫu chứng từ (đường dẫn folder + tên).",
    data,
  });
}

async function listCategoryTemplatesController(req, res) {
  const data = await listCategoryTemplates({
    userId: req.user.id,
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

async function getChungTuSignatureSettingsController(req, res) {
  const data = await getChungTuSignatureSettings({
    categoryKey: req.validatedQuery.categoryKey,
  });
  return respondSuccess(res, {
    message: data ? "Cấu hình chữ ký theo loại chứng từ." : "Chưa có cấu hình chữ ký đã lưu.",
    data,
  });
}

async function putChungTuSignatureSettingsController(req, res) {
  const data = await upsertChungTuSignatureSettings({
    categoryKey: req.validatedBody.categoryKey,
    signatureBlock: req.validatedBody.signatureBlock,
    extraFields: req.validatedBody.extraFields,
    updatedById: req.user.id,
  });
  return respondSuccess(res, {
    message: "Đã lưu cấu hình chữ ký.",
    data,
  });
}

async function getChungTuBkmhHeaderSettingsController(req, res) {
  const data = await getChungTuBkmhHeaderSettings({
    categoryKey: req.validatedQuery.categoryKey,
  });
  return respondSuccess(res, {
    message: data ? "Cấu hình header BKMH." : "Chưa có cấu hình header BKMH đã lưu.",
    data,
  });
}

async function putChungTuBkmhHeaderSettingsController(req, res) {
  const data = await upsertChungTuBkmhHeaderSettings({
    categoryKey: req.validatedBody.categoryKey,
    hoTenNguoiMua: req.validatedBody.hoTenNguoiMua,
    boPhan: req.validatedBody.boPhan,
    updatedById: req.user.id,
  });
  return respondSuccess(res, {
    message: "Đã lưu cấu hình header BKMH.",
    data,
  });
}

async function getChungTuPdfFieldCatalogController(req, res) {
  return respondSuccess(res, {
    message: "Catalog field cho mẫu PDF chứng từ.",
    data: getChungTuPdfFieldCatalog(),
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
    aggregationMode: body.aggregationMode,
    templateDriveFileId: body.templateDriveFileId,
    templateDisplayName: body.templateDisplayName,
    settings: body.settings ?? {},
    createdById: req.user.id,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: result.created
      ? "Đã tạo chứng từ Google Sheets và đồng bộ dữ liệu."
      : body.categoryKey === "bang-ke-mua-hang"
        ? "Bảng kê tháng này đã có — đã đồng bộ lại file hiện có."
        : body.categoryKey === "phieu-nhap-kho"
          ? "Phiếu nhập kho tháng này đã có — đã đồng bộ lại file hiện có."
          : "Chứng từ đã tồn tại — đã đồng bộ lại file hiện có.",
    data: result,
  });
}

async function listBkmhSnapshotsController(req, res) {
  const data = await listBkmhSnapshotsByDocumentKey({
    documentKey: req.validatedParams.documentKey,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Lịch sử snapshot bảng kê mua hàng.",
    data,
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

async function previewChungTuContextController(req, res) {
  const body = req.validatedBody;
  const data = await previewChungTuContext({
    categoryKey: body.categoryKey,
    unitId: body.unitId,
    periodDate: body.periodDate,
    periodMonth: body.periodMonth,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    issueSlipId: body.issueSlipId,
    unitIds: body.unitIds,
    aggregationMode: body.aggregationMode,
    settings: body.settings ?? {},
    exportingUserProfile: req.user?.profile ?? null,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "Xem trước dữ liệu nguồn từ LTTP.",
    data,
  });
}

async function getCategoryTemplateFillMappingController(req, res) {
  const data = await getCategoryTemplateFillMapping({
    userId: req.user.id,
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
    userId: req.user.id,
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

async function seedTemplatesFromSystemController(req, res) {
  const data = await seedUserTemplatesFromSystem({ userId: req.user.id });
  const { totals } = data;
  const message =
    totals.available === 0
      ? "Drive hệ thống chưa có mẫu nào để sao chép."
      : `Đã sao chép ${totals.copied} mẫu, bỏ qua ${totals.skipped} mẫu đã có.`;
  return respondSuccess(res, { message, data });
}

export {
  chungTuQuyetToanHealthController,
  checkChungTuDocumentStaleController,
  seedTemplatesFromSystemController,
  createChungTuPdfTemplateController,
  createChungTuBkmhMonthlyController,
  createChungTuPdfExportBatchController,
  createChungTuPdfExportController,
  createChungTuDocumentController,
  deleteChungTuBkmhMonthlyController,
  deleteChungTuDocumentController,
  deleteChungTuPdfExportBatchController,
  deleteChungTuPdfExportController,
  createTemplateCatalogController,
  deleteTemplateCatalogController,
  exportChungTuBkmhMonthlyExcelController,
  getChungTuBkmhMonthlyController,
  getChungTuDocumentController,
  getChungTuPdfExportBatchController,
  getChungTuPdfExportFileController,
  getChungTuPdfFieldCatalogController,
  getChungTuPdfTemplateFieldsController,
  getChungTuBkmhHeaderSettingsController,
  getCategoryTemplateFillMappingController,
  getChungTuSignatureSettingsController,
  getChungTuUnitProfileController,
  getTemplateFillRulesController,
  importDriveFileController,
  listChungTuBkmhMonthlyController,
  listChungTuPdfExportBatchesController,
  listChungTuPdfExportsController,
  listCategoryTemplatesController,
  listChungTuPdfTemplatesController,
  listChungTuDocumentsController,
  listBkmhSnapshotsController,
  listDriveTemplatesController,
  previewChungTuPdfTemplateController,
  listSpreadsheetNamedRangesController,
  listSpreadsheetNamedRangesSuperadminController,
  listTemplateCatalogController,
  listTemplateCatalogManageController,
  listTemplateTreeController,
  getTemplateTreeFileMetaController,
  patchTemplateCatalogController,
  previewChungTuContextController,
  publishChungTuPdfTemplateController,
  putChungTuPdfTemplateFieldLabelsController,
  putChungTuBkmhHeaderSettingsController,
  putCategoryTemplateFillMappingController,
  putChungTuSignatureSettingsController,
  putChungTuUnitProfileController,
  putTemplateFillRulesController,
  retireChungTuPdfTemplateController,
  streamChungTuBkmhMonthlyMergedPdfController,
  streamChungTuBkmhMonthlySliceFileController,
  streamChungTuBkmhMonthlyZipController,
  streamChungTuPdfExportBatchFileController,
  streamChungTuPdfExportBatchMergedPdfController,
  streamChungTuPdfExportBatchZipController,
  syncChungTuDocumentController,
  templateCatalogFieldRegistryController,
  uploadTemplateCatalogOfficeController,
};
