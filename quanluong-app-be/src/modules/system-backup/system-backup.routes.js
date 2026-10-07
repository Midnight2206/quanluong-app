import express from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  getSystemBackupController,
  getSystemBackupLogController,
  restoreSystemBackupController,
  runSystemBackupController,
} from "./system-backup.controller.js";

const restoreBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const systemBackupRouter = express.Router();

systemBackupRouter.use(authMiddleware, superadminMiddleware);

systemBackupRouter.get("/", asyncHandler(getSystemBackupController));

systemBackupRouter.post(
  "/restore",
  validateRequest({ body: restoreBodySchema }),
  asyncHandler(restoreSystemBackupController),
);

systemBackupRouter.post("/backup", asyncHandler(runSystemBackupController));
systemBackupRouter.get("/log", asyncHandler(getSystemBackupLogController));

export { systemBackupRouter };
