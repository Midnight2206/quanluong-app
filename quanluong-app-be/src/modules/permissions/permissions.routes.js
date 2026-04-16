import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { listPermissionsController, patchPermissionController } from "./permissions.controller.js";
import { PERMISSIONS_ROUTE_DEFINITIONS } from "./permissions.route-definitions.js";
import { patchPermissionBodySchema, permissionIdParamsSchema } from "./permissions.validator.js";

const permissionsRouter = express.Router();

const routePermissions = Object.fromEntries(
  PERMISSIONS_ROUTE_DEFINITIONS.map((def) => [def.key, def.permission.code]),
);

permissionsRouter.use(authMiddleware);

permissionsRouter.get(
  "/",
  permissionMiddleware([routePermissions.listPermissions]),
  asyncHandler(listPermissionsController),
);

permissionsRouter.patch(
  "/:id",
  validateRequest({
    params: permissionIdParamsSchema,
    body: patchPermissionBodySchema,
  }),
  permissionMiddleware([routePermissions.patchPermissionDescription]),
  asyncHandler(patchPermissionController),
);

export { permissionsRouter };
