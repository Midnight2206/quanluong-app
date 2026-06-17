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
  createChungTuDocumentController,
  createTemplateCatalogController,
  deleteChungTuDocumentController,
  deleteTemplateCatalogController,
  exportBkmhExcelController,
  getChungTuDocumentController,
  getExcelTemplateMetadataController,
  getChungTuUnitProfileController,
  getCategoryTemplateFillMappingController,
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
} from "./chung-tu-quyet-toan.controller.js";
import {
  categoryKeyParamSchema,
  categoryTemplateDriveParamsSchema,
  putCategoryTemplateFillMappingBodySchema,
  chungTuContextPreviewBodySchema,
  chungTuDocumentCreateBodySchema,
  chungTuDocumentsListQuerySchema,
  chungTuUnitProfilePutBodySchema,
  documentKeyParamSchema,
  driveFileIdParamsSchema,
  driveImportBodySchema,
  driveImportQuerySchema,
  excelBkmhExportBodySchema,
  excelTemplateIdParamSchema,
  excelTemplateMappingBodySchema,
  excelTemplateQuerySchema,
  excelTemplateUploadBodySchema,
  putTemplateFillRulesBodySchema,
  templateCatalogCreateBodySchema,
  templateCatalogIdParamSchema,
  templateCatalogManageQuerySchema,
  templateCatalogPatchBodySchema,
  templateCatalogQuerySchema,
  templateCatalogUploadBodySchema,
  templateFieldRegistryQuerySchema,
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

function excelTemplateUploadMiddleware(req, res, next) {
  driveImportUpload.single("file")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(
        new AppError({
          message: "File Excel tối đa 32MB.",
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

const LTTP_COMM = DATA_SCOPE_KINDS.LTTP_COMMODITY.code;

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

chungTuQuyetToanRouter.get(
  "/documents/:documentKey/print-pdf",
  permissionMiddleware([routePermissions.documentPrintPdf]),
  validateRequest({ params: documentKeyParamSchema }),
  asyncHandler(printChungTuDocumentPdfController),
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
  "/excel-templates",
  permissionMiddleware([routePermissions.excelTemplatesList]),
  validateRequest({ query: excelTemplateQuerySchema }),
  asyncHandler(listExcelTemplatesController),
);

chungTuQuyetToanRouter.post(
  "/excel-templates",
  permissionMiddleware([routePermissions.excelTemplatesUpload]),
  excelTemplateUploadMiddleware,
  validateRequest({ body: excelTemplateUploadBodySchema }),
  asyncHandler(uploadExcelTemplateController),
);

chungTuQuyetToanRouter.get(
  "/excel-templates/:id/metadata",
  permissionMiddleware([routePermissions.excelTemplateMetadata]),
  validateRequest({ params: excelTemplateIdParamSchema }),
  asyncHandler(getExcelTemplateMetadataController),
);

chungTuQuyetToanRouter.put(
  "/excel-templates/:id/mapping",
  permissionMiddleware([routePermissions.excelTemplateMappingPut]),
  validateRequest({ params: excelTemplateIdParamSchema, body: excelTemplateMappingBodySchema }),
  asyncHandler(putExcelTemplateMappingController),
);

chungTuQuyetToanRouter.post(
  "/excel-exports/bkmh",
  permissionMiddleware([routePermissions.excelBkmhExport]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  validateRequest({ body: excelBkmhExportBodySchema }),
  asyncHandler(exportBkmhExcelController),
);

chungTuQuyetToanRouter.get(
  "/excel-exports/history",
  permissionMiddleware([routePermissions.excelExportHistory]),
  validateRequest({ query: excelTemplateQuerySchema }),
  asyncHandler(listExcelExportHistoryController),
);

chungTuQuyetToanRouter.post(
  "/context-preview",
  permissionMiddleware([routePermissions.contextPreview]),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["periodDate"] }),
  validateRequest({ body: chungTuContextPreviewBodySchema }),
  asyncHandler(previewChungTuContextController),
);

export { chungTuQuyetToanRouter };
