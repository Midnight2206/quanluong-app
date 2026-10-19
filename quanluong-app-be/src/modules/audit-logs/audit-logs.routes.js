import express from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { exportController, listUsageController, listUsagePagesController, usageBatchController, getChangeController, listAuthController, listChangesController, listUsersController } from "./audit-logs.controller.js";
import { AUDIT_LOGS_ROUTE_DEFINITIONS } from "./audit-logs.route-definitions.js";
import { exportParamsSchema, authQuerySchema, changesQuerySchema, idParamsSchema, usageBatchBodySchema, usagePagesQuerySchema, usageQuerySchema } from "./audit-logs.validator.js";

const perm = Object.fromEntries(AUDIT_LOGS_ROUTE_DEFINITIONS.map((r) => [r.key, r.permission.code]));

const auditLogsRouter = express.Router();
auditLogsRouter.use(authMiddleware);

// Mọi user đăng nhập: gửi sự kiện sử dụng của chính mình (trước khi gắn phạm vi đơn vị).
auditLogsRouter.post(
  "/usage/batch",
  rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }),
  validateRequest({ body: usageBatchBodySchema }),
  asyncHandler(usageBatchController),
);
auditLogsRouter.use(unitScopeMiddleware);

// Đăng ký trước "/changes/:id" để "/changes/export" không bị bắt nhầm.
auditLogsRouter.get(
  "/:tab/export",
  validateRequest({ params: exportParamsSchema }),
  permissionMiddleware([perm.exportLogs]),
  asyncHandler(exportController),
);

auditLogsRouter.get(
  "/auth",
  validateRequest({ query: authQuerySchema }),
  permissionMiddleware([perm.listAuth]),
  asyncHandler(listAuthController),
);
auditLogsRouter.get(
  "/changes",
  validateRequest({ query: changesQuerySchema }),
  permissionMiddleware([perm.listChanges]),
  asyncHandler(listChangesController),
);
auditLogsRouter.get(
  "/changes/:id",
  validateRequest({ params: idParamsSchema }),
  permissionMiddleware([perm.getChange]),
  asyncHandler(getChangeController),
);
auditLogsRouter.get(
  "/usage",
  validateRequest({ query: usageQuerySchema }),
  permissionMiddleware([perm.listUsage]),
  asyncHandler(listUsageController),
);
auditLogsRouter.get(
  "/usage/pages",
  validateRequest({ query: usagePagesQuerySchema }),
  permissionMiddleware([perm.listUsagePages]),
  asyncHandler(listUsagePagesController),
);
auditLogsRouter.get("/users", permissionMiddleware([perm.listUsers]), asyncHandler(listUsersController));

export { auditLogsRouter };
