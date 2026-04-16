import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { effectiveUnitScopeMiddleware } from "../../middlewares/effective-unit-scope.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  applyJobTitleToUnitController,
  createJobTitleController,
  deleteJobTitleController,
  getJobTitleController,
  listJobTitlesController,
  patchJobTitleController,
  setJobTitlePermissionsController,
} from "./job-titles.controller.js";
import { JOB_TITLES_ROUTE_DEFINITIONS } from "./job-titles.route-definitions.js";
import {
  applyJobTitleToUnitBodySchema,
  createJobTitleBodySchema,
  jobTitleParamsSchema,
  patchJobTitleBodySchema,
  setJobTitlePermissionsBodySchema,
} from "./job-titles.validator.js";

const jobTitlesRouter = express.Router();

const routePermissions = Object.fromEntries(
  JOB_TITLES_ROUTE_DEFINITIONS.map((d) => [d.key, d.permission.code]),
);

jobTitlesRouter.use(authMiddleware);
jobTitlesRouter.use(unitScopeMiddleware);
jobTitlesRouter.use(effectiveUnitScopeMiddleware);

jobTitlesRouter.get(
  "/",
  permissionMiddleware([routePermissions.listJobTitles]),
  asyncHandler(listJobTitlesController),
);

jobTitlesRouter.get(
  "/:id",
  validateRequest({ params: jobTitleParamsSchema }),
  permissionMiddleware([routePermissions.getJobTitle]),
  asyncHandler(getJobTitleController),
);

jobTitlesRouter.post(
  "/",
  validateRequest({ body: createJobTitleBodySchema }),
  permissionMiddleware([routePermissions.createJobTitle]),
  asyncHandler(createJobTitleController),
);

jobTitlesRouter.patch(
  "/:id",
  validateRequest({ params: jobTitleParamsSchema, body: patchJobTitleBodySchema }),
  permissionMiddleware([routePermissions.patchJobTitle]),
  asyncHandler(patchJobTitleController),
);

jobTitlesRouter.put(
  "/:id/permissions",
  validateRequest({
    params: jobTitleParamsSchema,
    body: setJobTitlePermissionsBodySchema,
  }),
  permissionMiddleware([routePermissions.setJobTitlePermissions]),
  asyncHandler(setJobTitlePermissionsController),
);

jobTitlesRouter.post(
  "/:id/apply-to-unit",
  validateRequest({
    params: jobTitleParamsSchema,
    body: applyJobTitleToUnitBodySchema,
  }),
  permissionMiddleware([routePermissions.applyJobTitleToUnit]),
  asyncHandler(applyJobTitleToUnitController),
);

jobTitlesRouter.delete(
  "/:id",
  validateRequest({ params: jobTitleParamsSchema }),
  permissionMiddleware([routePermissions.deleteJobTitle]),
  asyncHandler(deleteJobTitleController),
);

export { jobTitlesRouter };
