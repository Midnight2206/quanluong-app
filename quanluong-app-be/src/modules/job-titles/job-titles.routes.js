import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { effectiveUnitScopeMiddleware } from "../../middlewares/effective-unit-scope.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { unitDataScopeMiddleware } from "../../middlewares/unit-data-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { DATA_SCOPE_KINDS } from "../../shared/data-scope/data-scope.registry.js";
import {
  createJobTitleController,
  deleteJobTitleController,
  getJobTitleController,
  listJobTitlesController,
  patchJobTitleController,
  setJobTitlePermissionsController,
} from "./job-titles.controller.js";
import { JOB_TITLES_ROUTE_DEFINITIONS } from "./job-titles.route-definitions.js";
import {
  createJobTitleBodySchema,
  jobTitleParamsSchema,
  patchJobTitleBodySchema,
  setJobTitlePermissionsBodySchema,
} from "./job-titles.validator.js";

const jobTitlesRouter = express.Router();

const routePermissions = Object.fromEntries(
  JOB_TITLES_ROUTE_DEFINITIONS.map((d) => [d.key, d.permission.code]),
);

const jobTitleDataScopeMw = unitDataScopeMiddleware({
  dataKind: DATA_SCOPE_KINDS.JOB_TITLE.code,
});

jobTitlesRouter.use(authMiddleware);
jobTitlesRouter.use(unitScopeMiddleware);
jobTitlesRouter.use(effectiveUnitScopeMiddleware);
jobTitlesRouter.use(jobTitleDataScopeMw);

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

jobTitlesRouter.delete(
  "/:id",
  validateRequest({ params: jobTitleParamsSchema }),
  permissionMiddleware([routePermissions.deleteJobTitle]),
  asyncHandler(deleteJobTitleController),
);

export { jobTitlesRouter };
