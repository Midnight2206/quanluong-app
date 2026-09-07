import express from "express";
import multer from "multer";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
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
} from "./document-dev.controller.js";
import {
  documentIdParamsSchema,
  renderDocumentBodySchema,
  renderStoredPdfBodySchema,
  templateIdParamsSchema,
} from "./document-dev.validator.js";

const documentDevRouter = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

documentDevRouter.use(authMiddleware, superadminMiddleware);

documentDevRouter.get("/health", asyncHandler(documentDevHealthController));

documentDevRouter.get("/templates", asyncHandler(listDocumentTemplatesController));

documentDevRouter.post(
  "/templates",
  upload.single("file"),
  asyncHandler(uploadDocumentTemplateController),
);

documentDevRouter.get(
  "/templates/:id",
  validateRequest({ params: templateIdParamsSchema }),
  asyncHandler(getDocumentTemplateController),
);

documentDevRouter.get(
  "/templates/:id/fields",
  validateRequest({ params: templateIdParamsSchema }),
  asyncHandler(getDocumentTemplateFieldsController),
);

documentDevRouter.post(
  "/templates/:id/documents",
  validateRequest({ params: templateIdParamsSchema, body: renderDocumentBodySchema }),
  asyncHandler(renderDocumentPdfController),
);

documentDevRouter.post(
  "/demo-documents/bien-ban-test-v2",
  asyncHandler(seedBienBanTestV2DemoController),
);

documentDevRouter.post(
  "/demo-documents/template/:id",
  validateRequest({ params: templateIdParamsSchema }),
  asyncHandler(seedDemoForTemplateController),
);

documentDevRouter.get(
  "/documents/:id",
  validateRequest({ params: documentIdParamsSchema }),
  asyncHandler(getDocumentController),
);

documentDevRouter.post(
  "/documents/:id/pdf",
  validateRequest({ params: documentIdParamsSchema, body: renderStoredPdfBodySchema }),
  asyncHandler(renderStoredDocumentPdfController),
);

export { documentDevRouter };
