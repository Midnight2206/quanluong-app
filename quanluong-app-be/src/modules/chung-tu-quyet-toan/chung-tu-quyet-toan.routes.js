import express from "express";
import multer from "multer";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { effectiveUnitScopeMiddleware } from "../../middlewares/effective-unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { unitDataScopeMiddleware } from "../../middlewares/unit-data-scope.middleware.js";
import { DATA_SCOPE_KINDS } from "../../shared/data-scope/data-scope.registry.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { CHUNG_TU_QUYET_TOAN_ROUTE_DEFINITIONS } from "./chung-tu-quyet-toan.route-definitions.js";
import {
  chungTuQuyetToanHealthController,
  checkChungTuDocumentStaleController,
  seedTemplatesFromSystemController,
  createChungTuPdfExportBatchController,
  createChungTuPdfTemplateController,
  createChungTuPdfExportController,
  createChungTuDocumentController,
  createTemplateCatalogController,
  deleteChungTuDocumentController,
  deleteChungTuPdfExportBatchController,
  deleteChungTuPdfExportController,
  deleteTemplateCatalogController,
  getChungTuDocumentController,
  getChungTuPdfExportBatchController,
  getChungTuPdfExportFileController,
  getChungTuPdfFieldCatalogController,
  getChungTuPdfTemplateFieldsController,
  getChungTuSignatureSettingsController,
  getChungTuUnitProfileController,
  getCategoryTemplateFillMappingController,
  getTemplateFillRulesController,
  importDriveFileController,
  listCategoryTemplatesController,
  listChungTuPdfExportBatchesController,
  listChungTuPdfExportsController,
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
  putCategoryTemplateFillMappingController,
  putChungTuSignatureSettingsController,
  putChungTuUnitProfileController,
  putTemplateFillRulesController,
  retireChungTuPdfTemplateController,
  streamChungTuPdfExportBatchFileController,
  streamChungTuPdfExportBatchMergedPdfController,
  streamChungTuPdfExportBatchZipController,
  syncChungTuDocumentController,
  templateCatalogFieldRegistryController,
  uploadTemplateCatalogOfficeController,
} from "./chung-tu-quyet-toan.controller.js";
import {
  categoryKeyParamSchema,
  categoryTemplateDriveParamsSchema,
  chungTuPdfExportBatchCreateBodySchema,
  chungTuPdfExportBatchFileParamsSchema,
  chungTuPdfExportBatchKeyParamSchema,
  chungTuPdfExportBatchListQuerySchema,
  chungTuPdfTemplateIdParamSchema,
  chungTuPdfExportCreateBodySchema,
  chungTuPdfExportKeyParamSchema,
  chungTuPdfTemplateListQuerySchema,
  chungTuPdfTemplateUploadBodySchema,
  chungTuSignatureSettingsPutBodySchema,
  chungTuSignatureSettingsQuerySchema,
  putCategoryTemplateFillMappingBodySchema,
  chungTuContextPreviewBodySchema,
  chungTuDocumentCreateBodySchema,
  chungTuDocumentsListQuerySchema,
  chungTuUnitProfilePutBodySchema,
  documentKeyParamSchema,
  driveFileIdParamsSchema,
  driveImportBodySchema,
  driveImportQuerySchema,
  putTemplateFillRulesBodySchema,
  templateCatalogCreateBodySchema,
  templateCatalogIdParamSchema,
  templateCatalogManageQuerySchema,
  templateCatalogPatchBodySchema,
  templateCatalogQuerySchema,
  templateCatalogUploadBodySchema,
  templateFieldRegistryQuerySchema,
  templateTreeFileParamsSchema,
  templateTreeQuerySchema,
  unitIdQuerySchema,
} from "./chung-tu-quyet-toan.validator.js";

const chungTuQuyetToanRouter = express.Router();

const driveImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
});

function driveImportMulterMiddleware(req, res, next) {
  driveImportUpload.single("file")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(
        new AppError({
          message: "File tối đa 32MB.",
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        }),
      );
      return;
    }
    next(err);
  });
}

const routePermissions = Object.fromEntries(
  CHUNG_TU_QUYET_TOAN_ROUTE_DEFINITIONS.map((d) => [d.key, d.permission.code]),
);
const LTTP_COMM = DATA_SCOPE_KINDS.LTTP_COMMODITY.code;

chungTuQuyetToanRouter.use(authMiddleware);
chungTuQuyetToanRouter.use(unitScopeMiddleware);
chungTuQuyetToanRouter.use(effectiveUnitScopeMiddleware);

chungTuQuyetToanRouter.get(
  "/health",
  permissionMiddleware([routePermissions.health]),
  asyncHandler(chungTuQuyetToanHealthController),
);

chungTuQuyetToanRouter.get(
  "/drive-templates",
  permissionMiddleware([routePermissions.driveTemplates]),
  asyncHandler(listDriveTemplatesController),
);

chungTuQuyetToanRouter.get(
  "/spreadsheet-named-ranges/:driveFileId",
  permissionMiddleware([routePermissions.sheetNamedRanges]),
  validateRequest({ params: driveFileIdParamsSchema }),
  asyncHandler(listSpreadsheetNamedRangesController),
);

chungTuQuyetToanRouter.get(
  "/template-fill-rules/:driveFileId",
  permissionMiddleware([routePermissions.templateFillRulesGet]),
  validateRequest({ params: driveFileIdParamsSchema }),
  asyncHandler(getTemplateFillRulesController),
);

chungTuQuyetToanRouter.put(
  "/template-fill-rules/:driveFileId",
  permissionMiddleware([routePermissions.templateFillRulesPut]),
  validateRequest({
    params: driveFileIdParamsSchema,
    body: putTemplateFillRulesBodySchema,
  }),
  asyncHandler(putTemplateFillRulesController),
);

chungTuQuyetToanRouter.get(
  "/template-catalog/manage",
  superadminMiddleware,
  validateRequest({ query: templateCatalogManageQuerySchema }),
  asyncHandler(listTemplateCatalogManageController),
);

chungTuQuyetToanRouter.get(
  "/template-catalog/field-registry",
  superadminMiddleware,
  validateRequest({ query: templateFieldRegistryQuerySchema }),
  asyncHandler(templateCatalogFieldRegistryController),
);

chungTuQuyetToanRouter.get(
  "/super/spreadsheet-named-ranges/:driveFileId",
  superadminMiddleware,
  validateRequest({ params: driveFileIdParamsSchema }),
  asyncHandler(listSpreadsheetNamedRangesSuperadminController),
);

chungTuQuyetToanRouter.post(
  "/template-catalog",
  superadminMiddleware,
  validateRequest({ body: templateCatalogCreateBodySchema }),
  asyncHandler(createTemplateCatalogController),
);

chungTuQuyetToanRouter.post(
  "/template-catalog/upload",
  superadminMiddleware,
  driveImportMulterMiddleware,
  validateRequest({ body: templateCatalogUploadBodySchema }),
  asyncHandler(uploadTemplateCatalogOfficeController),
);

chungTuQuyetToanRouter.patch(
  "/template-catalog/:id",
  superadminMiddleware,
  validateRequest({ params: templateCatalogIdParamSchema, body: templateCatalogPatchBodySchema }),
  asyncHandler(patchTemplateCatalogController),
);

chungTuQuyetToanRouter.delete(
  "/template-catalog/:id",
  superadminMiddleware,
  validateRequest({ params: templateCatalogIdParamSchema }),
  asyncHandler(deleteTemplateCatalogController),
);

chungTuQuyetToanRouter.get(
  "/template-catalog",
  permissionMiddleware([routePermissions.templateCatalogList]),
  validateRequest({ query: templateCatalogQuerySchema }),
  asyncHandler(listTemplateCatalogController),
);

chungTuQuyetToanRouter.get(
  "/pdf-templates",
  permissionMiddleware([routePermissions.pdfTemplateList]),
  validateRequest({ query: chungTuPdfTemplateListQuerySchema }),
  asyncHandler(listChungTuPdfTemplatesController),
);

chungTuQuyetToanRouter.post(
  "/pdf-templates",
  superadminMiddleware,
  driveImportMulterMiddleware,
  validateRequest({ body: chungTuPdfTemplateUploadBodySchema }),
  asyncHandler(createChungTuPdfTemplateController),
);

chungTuQuyetToanRouter.delete(
  "/pdf-templates/:id",
  superadminMiddleware,
  validateRequest({ params: chungTuPdfTemplateIdParamSchema }),
  asyncHandler(retireChungTuPdfTemplateController),
);

chungTuQuyetToanRouter.get(
  "/pdf-templates/:id/preview",
  superadminMiddleware,
  validateRequest({ params: chungTuPdfTemplateIdParamSchema }),
  asyncHandler(previewChungTuPdfTemplateController),
);

chungTuQuyetToanRouter.post(
  "/pdf-templates/:id/publish",
  superadminMiddleware,
  validateRequest({ params: chungTuPdfTemplateIdParamSchema }),
  asyncHandler(publishChungTuPdfTemplateController),
);

chungTuQuyetToanRouter.post(
  "/pdf-templates/:id/retire",
  superadminMiddleware,
  validateRequest({ params: chungTuPdfTemplateIdParamSchema }),
  asyncHandler(retireChungTuPdfTemplateController),
);

chungTuQuyetToanRouter.get(
  "/pdf-templates/:id/fields",
  permissionMiddleware([routePermissions.pdfTemplateFields]),
  validateRequest({ params: chungTuPdfTemplateIdParamSchema }),
  asyncHandler(getChungTuPdfTemplateFieldsController),
);

chungTuQuyetToanRouter.get(
  "/pdf-exports",
  permissionMiddleware([routePermissions.pdfExportList]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["from", "to"] }),
  validateRequest({ query: chungTuDocumentsListQuerySchema }),
  asyncHandler(listChungTuPdfExportsController),
);

chungTuQuyetToanRouter.post(
  "/pdf-exports",
  permissionMiddleware([routePermissions.pdfExportCreate]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["periodDate"] }),
  validateRequest({ body: chungTuPdfExportCreateBodySchema }),
  asyncHandler(createChungTuPdfExportController),
);

chungTuQuyetToanRouter.get(
  "/pdf-exports/:exportKey/file",
  permissionMiddleware([routePermissions.pdfExportFile]),
  validateRequest({ params: chungTuPdfExportKeyParamSchema }),
  asyncHandler(getChungTuPdfExportFileController),
);

chungTuQuyetToanRouter.delete(
  "/pdf-exports/:exportKey",
  permissionMiddleware([routePermissions.pdfExportDelete]),
  validateRequest({ params: chungTuPdfExportKeyParamSchema }),
  asyncHandler(deleteChungTuPdfExportController),
);

chungTuQuyetToanRouter.get(
  "/pdf-export-batches",
  permissionMiddleware([routePermissions.pdfExportBatchList]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  validateRequest({ query: chungTuPdfExportBatchListQuerySchema }),
  asyncHandler(listChungTuPdfExportBatchesController),
);

chungTuQuyetToanRouter.post(
  "/pdf-export-batches",
  permissionMiddleware([routePermissions.pdfExportBatchCreate]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["periodDate"] }),
  validateRequest({ body: chungTuPdfExportBatchCreateBodySchema }),
  asyncHandler(createChungTuPdfExportBatchController),
);

chungTuQuyetToanRouter.get(
  "/pdf-export-batches/:batchKey",
  permissionMiddleware([routePermissions.pdfExportBatchDetail]),
  validateRequest({ params: chungTuPdfExportBatchKeyParamSchema }),
  asyncHandler(getChungTuPdfExportBatchController),
);

chungTuQuyetToanRouter.get(
  "/pdf-export-batches/:batchKey/zip",
  permissionMiddleware([routePermissions.pdfExportBatchZip]),
  validateRequest({ params: chungTuPdfExportBatchKeyParamSchema }),
  asyncHandler(streamChungTuPdfExportBatchZipController),
);

chungTuQuyetToanRouter.get(
  "/pdf-export-batches/:batchKey/merged.pdf",
  permissionMiddleware([routePermissions.pdfExportBatchMergedPdf]),
  validateRequest({ params: chungTuPdfExportBatchKeyParamSchema }),
  asyncHandler(streamChungTuPdfExportBatchMergedPdfController),
);

chungTuQuyetToanRouter.get(
  "/pdf-export-batches/:batchKey/files/:fileId",
  permissionMiddleware([routePermissions.pdfExportBatchFile]),
  validateRequest({ params: chungTuPdfExportBatchFileParamsSchema }),
  asyncHandler(streamChungTuPdfExportBatchFileController),
);

chungTuQuyetToanRouter.delete(
  "/pdf-export-batches/:batchKey",
  permissionMiddleware([routePermissions.pdfExportBatchDelete]),
  validateRequest({ params: chungTuPdfExportBatchKeyParamSchema }),
  asyncHandler(deleteChungTuPdfExportBatchController),
);

chungTuQuyetToanRouter.get(
  "/signature-settings",
  permissionMiddleware([routePermissions.signatureSettingsGet]),
  validateRequest({ query: chungTuSignatureSettingsQuerySchema }),
  asyncHandler(getChungTuSignatureSettingsController),
);

chungTuQuyetToanRouter.put(
  "/signature-settings",
  permissionMiddleware([routePermissions.signatureSettingsPut]),
  validateRequest({ body: chungTuSignatureSettingsPutBodySchema }),
  asyncHandler(putChungTuSignatureSettingsController),
);

chungTuQuyetToanRouter.get(
  "/pdf-template-field-catalog",
  permissionMiddleware([routePermissions.pdfTemplateFieldCatalog]),
  asyncHandler(getChungTuPdfFieldCatalogController),
);

chungTuQuyetToanRouter.get(
  "/template-tree",
  permissionMiddleware([routePermissions.templateTreeBrowse]),
  validateRequest({ query: templateTreeQuerySchema }),
  asyncHandler(listTemplateTreeController),
);

chungTuQuyetToanRouter.get(
  "/template-tree/files/:driveFileId",
  permissionMiddleware([routePermissions.templateTreeFileMeta]),
  validateRequest({ params: templateTreeFileParamsSchema }),
  asyncHandler(getTemplateTreeFileMetaController),
);

chungTuQuyetToanRouter.post(
  "/drive-import",
  permissionMiddleware([routePermissions.driveImport]),
  driveImportMulterMiddleware,
  validateRequest({
    query: driveImportQuerySchema,
    body: driveImportBodySchema,
  }),
  asyncHandler(importDriveFileController),
);

chungTuQuyetToanRouter.get(
  "/category-templates/:categoryKey",
  permissionMiddleware([routePermissions.categoryTemplates]),
  validateRequest({ params: categoryKeyParamSchema }),
  asyncHandler(listCategoryTemplatesController),
);

chungTuQuyetToanRouter.get(
  "/category-templates/:categoryKey/:driveFileId/fill-mapping",
  permissionMiddleware([routePermissions.categoryTemplateFillMappingGet]),
  validateRequest({ params: categoryTemplateDriveParamsSchema }),
  asyncHandler(getCategoryTemplateFillMappingController),
);

chungTuQuyetToanRouter.put(
  "/category-templates/:categoryKey/:driveFileId/fill-mapping",
  permissionMiddleware([routePermissions.categoryTemplateFillMappingPut]),
  validateRequest({
    params: categoryTemplateDriveParamsSchema,
    body: putCategoryTemplateFillMappingBodySchema,
  }),
  asyncHandler(putCategoryTemplateFillMappingController),
);

chungTuQuyetToanRouter.get(
  "/unit-profile",
  permissionMiddleware([routePermissions.unitProfileGet]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  validateRequest({ query: unitIdQuerySchema }),
  asyncHandler(getChungTuUnitProfileController),
);

chungTuQuyetToanRouter.put(
  "/unit-profile",
  permissionMiddleware([routePermissions.unitProfilePut]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  validateRequest({ body: chungTuUnitProfilePutBodySchema }),
  asyncHandler(putChungTuUnitProfileController),
);

chungTuQuyetToanRouter.get(
  "/documents",
  permissionMiddleware([routePermissions.documentsList]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["from", "to"] }),
  validateRequest({ query: chungTuDocumentsListQuerySchema }),
  asyncHandler(listChungTuDocumentsController),
);

chungTuQuyetToanRouter.get(
  "/documents/:documentKey",
  permissionMiddleware([routePermissions.documentGet]),
  validateRequest({ params: documentKeyParamSchema }),
  asyncHandler(getChungTuDocumentController),
);

chungTuQuyetToanRouter.post(
  "/documents",
  permissionMiddleware([routePermissions.documentCreate]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["periodDate"] }),
  validateRequest({ body: chungTuDocumentCreateBodySchema }),
  asyncHandler(createChungTuDocumentController),
);

chungTuQuyetToanRouter.post(
  "/documents/:documentKey/sync",
  permissionMiddleware([routePermissions.documentSync]),
  validateRequest({ params: documentKeyParamSchema }),
  asyncHandler(syncChungTuDocumentController),
);

chungTuQuyetToanRouter.delete(
  "/documents/:documentKey",
  permissionMiddleware([routePermissions.documentDelete]),
  validateRequest({ params: documentKeyParamSchema }),
  asyncHandler(deleteChungTuDocumentController),
);

chungTuQuyetToanRouter.get(
  "/documents/:documentKey/stale-check",
  permissionMiddleware([routePermissions.documentStaleCheck]),
  validateRequest({ params: documentKeyParamSchema }),
  asyncHandler(checkChungTuDocumentStaleController),
);

chungTuQuyetToanRouter.get(
  "/documents/:documentKey/bkmh-snapshots",
  permissionMiddleware([routePermissions.documentBkmhSnapshots]),
  validateRequest({ params: documentKeyParamSchema }),
  asyncHandler(listBkmhSnapshotsController),
);

chungTuQuyetToanRouter.post(
  "/context-preview",
  permissionMiddleware([routePermissions.contextPreview]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["periodDate"] }),
  validateRequest({ body: chungTuContextPreviewBodySchema }),
  asyncHandler(previewChungTuContextController),
);

chungTuQuyetToanRouter.post(
  "/templates/seed-from-system",
  permissionMiddleware([routePermissions.templatesSeedFromSystem]),
  asyncHandler(seedTemplatesFromSystemController),
);

export { chungTuQuyetToanRouter };
