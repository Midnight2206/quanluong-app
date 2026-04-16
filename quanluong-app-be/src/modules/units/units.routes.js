import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { effectiveUnitScopeMiddleware } from "../../middlewares/effective-unit-scope.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  createPrivateDataShareController,
  createUnitController,
  deleteUnitController,
  getUnitDetailController,
  listPrivateDataSharesController,
  listUnitsController,
  patchUnitController,
  revokePrivateDataShareController,
} from "./units.controller.js";
import { UNITS_ROUTE_DEFINITIONS } from "./units.route-definitions.js";
import {
  createPrivateDataShareBodySchema,
  createUnitBodySchema,
  grantRevokeParamsSchema,
  listPrivateDataSharesQuerySchema,
  patchUnitBodySchema,
  unitParamsSchema,
} from "./units.validator.js";

const unitsRouter = express.Router();

const routePermissions = Object.fromEntries(
  UNITS_ROUTE_DEFINITIONS.map((routeDefinition) => [routeDefinition.key, routeDefinition.permission.code]),
);

unitsRouter.use(authMiddleware);
unitsRouter.use(unitScopeMiddleware);
unitsRouter.use(effectiveUnitScopeMiddleware);

unitsRouter.get(
  "/",
  permissionMiddleware([routePermissions.listUnits]),
  asyncHandler(listUnitsController),
);

unitsRouter.get(
  "/private-data-shares",
  validateRequest({ query: listPrivateDataSharesQuerySchema }),
  permissionMiddleware([routePermissions.listPrivateDataShares]),
  asyncHandler(listPrivateDataSharesController),
);

unitsRouter.post(
  "/private-data-shares",
  validateRequest({ body: createPrivateDataShareBodySchema }),
  permissionMiddleware([routePermissions.createPrivateDataShare]),
  asyncHandler(createPrivateDataShareController),
);

unitsRouter.patch(
  "/private-data-shares/:grantId/revoke",
  validateRequest({ params: grantRevokeParamsSchema }),
  permissionMiddleware([routePermissions.revokePrivateDataShare]),
  asyncHandler(revokePrivateDataShareController),
);

unitsRouter.get(
  "/:id",
  validateRequest({ params: unitParamsSchema }),
  permissionMiddleware([routePermissions.getUnitDetail]),
  asyncHandler(getUnitDetailController),
);

unitsRouter.post(
  "/",
  validateRequest({ body: createUnitBodySchema }),
  permissionMiddleware([routePermissions.createUnit]),
  asyncHandler(createUnitController),
);

unitsRouter.patch(
  "/:id",
  validateRequest({ params: unitParamsSchema, body: patchUnitBodySchema }),
  permissionMiddleware([routePermissions.patchUnit]),
  asyncHandler(patchUnitController),
);

unitsRouter.delete(
  "/:id",
  validateRequest({ params: unitParamsSchema }),
  permissionMiddleware([routePermissions.deleteUnit]),
  asyncHandler(deleteUnitController),
);

export { unitsRouter };
