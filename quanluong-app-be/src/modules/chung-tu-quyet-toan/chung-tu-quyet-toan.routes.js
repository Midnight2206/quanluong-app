import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { effectiveUnitScopeMiddleware } from "../../middlewares/effective-unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { CHUNG_TU_QUYET_TOAN_ROUTE_DEFINITIONS } from "./chung-tu-quyet-toan.route-definitions.js";
import { chungTuQuyetToanHealthController } from "./chung-tu-quyet-toan.controller.js";

const chungTuQuyetToanRouter = express.Router();

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

export { chungTuQuyetToanRouter };
