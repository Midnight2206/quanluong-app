import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  approveRegistrationController,
  listPendingRegistrationsController,
  rejectRegistrationController,
} from "./registrations.controller.js";
import { REGISTRATIONS_ROUTE_DEFINITIONS } from "./registrations.route-definitions.js";
import { rejectRegistrationBodySchema, registrationUserParamsSchema } from "./registrations.validator.js";

const registrationsRouter = express.Router();

const routePermissions = Object.fromEntries(
  REGISTRATIONS_ROUTE_DEFINITIONS.map((def) => [def.key, def.permission.code]),
);

registrationsRouter.use(authMiddleware);
registrationsRouter.use(unitScopeMiddleware);

registrationsRouter.get(
  "/pending",
  permissionMiddleware([routePermissions.listPendingRegistrations]),
  asyncHandler(listPendingRegistrationsController),
);

registrationsRouter.post(
  "/:userId/approve",
  validateRequest({ params: registrationUserParamsSchema }),
  permissionMiddleware([routePermissions.approveRegistration]),
  asyncHandler(approveRegistrationController),
);

registrationsRouter.post(
  "/:userId/reject",
  validateRequest({
    params: registrationUserParamsSchema,
    body: rejectRegistrationBodySchema,
  }),
  permissionMiddleware([routePermissions.rejectRegistration]),
  asyncHandler(rejectRegistrationController),
);

export { registrationsRouter };
