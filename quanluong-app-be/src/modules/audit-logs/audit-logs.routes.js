import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { getChangeController, listAuthController, listChangesController, listUsersController } from "./audit-logs.controller.js";
import { AUDIT_LOGS_ROUTE_DEFINITIONS } from "./audit-logs.route-definitions.js";
import { authQuerySchema, changesQuerySchema, idParamsSchema } from "./audit-logs.validator.js";

const perm = Object.fromEntries(AUDIT_LOGS_ROUTE_DEFINITIONS.map((r) => [r.key, r.permission.code]));

const auditLogsRouter = express.Router();
auditLogsRouter.use(authMiddleware);

auditLogsRouter.use(unitScopeMiddleware);

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
auditLogsRouter.get("/users", permissionMiddleware([perm.listUsers]), asyncHandler(listUsersController));

export { auditLogsRouter };
