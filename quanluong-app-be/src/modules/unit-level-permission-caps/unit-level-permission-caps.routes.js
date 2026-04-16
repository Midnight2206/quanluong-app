import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  getUnitLevelPermissionCapsByDepthController,
  listUnitLevelPermissionCapsController,
  replaceUnitLevelPermissionCapsController,
} from "./unit-level-permission-caps.controller.js";
import { UNIT_LEVEL_PERMISSION_CAPS_ROUTE_DEFINITIONS } from "./unit-level-permission-caps.route-definitions.js";
import { depthParamsSchema, replaceCapsBodySchema } from "./unit-level-permission-caps.validator.js";

const unitLevelPermissionCapsRouter = express.Router();

const routePermissions = Object.fromEntries(
  UNIT_LEVEL_PERMISSION_CAPS_ROUTE_DEFINITIONS.map((d) => [d.key, d.permission.code]),
);

unitLevelPermissionCapsRouter.use(authMiddleware);

unitLevelPermissionCapsRouter.get(
  "/",
  permissionMiddleware([routePermissions.listUnitLevelPermissionCaps]),
  asyncHandler(listUnitLevelPermissionCapsController),
);

unitLevelPermissionCapsRouter.get(
  "/:depth",
  validateRequest({ params: depthParamsSchema }),
  permissionMiddleware([routePermissions.getUnitLevelPermissionCapsByDepth]),
  asyncHandler(getUnitLevelPermissionCapsByDepthController),
);

unitLevelPermissionCapsRouter.put(
  "/:depth",
  validateRequest({
    params: depthParamsSchema,
    body: replaceCapsBodySchema,
  }),
  permissionMiddleware([routePermissions.replaceUnitLevelPermissionCaps]),
  asyncHandler(replaceUnitLevelPermissionCapsController),
);

export { unitLevelPermissionCapsRouter };
