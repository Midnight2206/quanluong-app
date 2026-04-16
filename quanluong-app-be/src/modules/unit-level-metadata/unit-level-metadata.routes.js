import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  listUnitLevelMetadataController,
  upsertUnitLevelMetadataController,
} from "./unit-level-metadata.controller.js";
import { UNIT_LEVEL_ROUTE_DEFINITIONS } from "./unit-level-metadata.route-definitions.js";
import { depthParamsSchema, upsertUnitLevelBodySchema } from "./unit-level-metadata.validator.js";

const unitLevelMetadataRouter = express.Router();

const routePermissions = Object.fromEntries(
  UNIT_LEVEL_ROUTE_DEFINITIONS.map((d) => [d.key, d.permission.code]),
);

unitLevelMetadataRouter.use(authMiddleware);

unitLevelMetadataRouter.get(
  "/",
  permissionMiddleware([routePermissions.listUnitLevelMetadata]),
  asyncHandler(listUnitLevelMetadataController),
);

unitLevelMetadataRouter.put(
  "/:depth",
  validateRequest({ params: depthParamsSchema, body: upsertUnitLevelBodySchema }),
  permissionMiddleware([routePermissions.upsertUnitLevelMetadata]),
  asyncHandler(upsertUnitLevelMetadataController),
);

export { unitLevelMetadataRouter };
