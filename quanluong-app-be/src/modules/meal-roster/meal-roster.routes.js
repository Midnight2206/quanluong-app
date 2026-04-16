import express from "express";
import multer from "multer";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { effectiveUnitScopeMiddleware } from "../../middlewares/effective-unit-scope.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { PERMISSIONS } from "../../shared/constants/permissions.js";
import {
  copyPreviousMealRosterController,
  createMealRosterEntryController,
  deleteMealRosterEntryController,
  downloadMealRosterTemplateController,
  importMealRosterController,
  listDayMarksController,
  listMealRosterController,
  mealRateCatalogController,
  mealRosterMetaController,
  patchMealRosterEntryController,
  putSelectedMealRatesController,
  replaceDayMarksController,
} from "./meal-roster.controller.js";
import { MEAL_ROSTER_ROUTE_DEFINITIONS } from "./meal-roster.route-definitions.js";
import {
  copyPreviousBodySchema,
  createBodySchema,
  idParamsSchema,
  importBodySchema,
  listQuerySchema,
  metaQuerySchema,
  patchBodySchema,
  putSelectedRatesBodySchema,
  replaceDayMarksBodySchema,
  unitIdQuerySchema,
} from "./meal-roster.validator.js";

const mealRosterRouter = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const routePermissions = Object.fromEntries(
  MEAL_ROSTER_ROUTE_DEFINITIONS.map((d) => [d.key, d.permission.code]),
);

mealRosterRouter.use(authMiddleware);
mealRosterRouter.use(unitScopeMiddleware);
mealRosterRouter.use(effectiveUnitScopeMiddleware);

mealRosterRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  permissionMiddleware([routePermissions.listMealRoster]),
  asyncHandler(listMealRosterController),
);

mealRosterRouter.get(
  "/meta",
  validateRequest({ query: metaQuerySchema }),
  permissionMiddleware([routePermissions.mealRosterMeta]),
  asyncHandler(mealRosterMetaController),
);

mealRosterRouter.get(
  "/import-template",
  validateRequest({ query: unitIdQuerySchema }),
  permissionMiddleware([routePermissions.downloadMealRosterTemplate]),
  asyncHandler(downloadMealRosterTemplateController),
);

mealRosterRouter.get(
  "/rate-catalog",
  permissionMiddleware([routePermissions.mealRateCatalog]),
  asyncHandler(mealRateCatalogController),
);

mealRosterRouter.put(
  "/selected-rates",
  validateRequest({ body: putSelectedRatesBodySchema }),
  permissionMiddleware([routePermissions.putSelectedMealRates]),
  asyncHandler(putSelectedMealRatesController),
);

mealRosterRouter.get(
  "/day-marks",
  validateRequest({ query: listQuerySchema }),
  permissionMiddleware([routePermissions.listMealRosterDayMarks]),
  asyncHandler(listDayMarksController),
);

mealRosterRouter.put(
  "/day-marks",
  validateRequest({ body: replaceDayMarksBodySchema }),
  permissionMiddleware([routePermissions.replaceMealRosterDayMarks]),
  asyncHandler(replaceDayMarksController),
);

mealRosterRouter.post(
  "/copy-previous",
  validateRequest({ body: copyPreviousBodySchema }),
  permissionMiddleware([routePermissions.copyPreviousMealRoster]),
  asyncHandler(copyPreviousMealRosterController),
);

mealRosterRouter.post(
  "/import",
  upload.single("file"),
  validateRequest({ body: importBodySchema }),
  permissionMiddleware([routePermissions.importMealRoster]),
  asyncHandler(importMealRosterController),
);

mealRosterRouter.post(
  "/",
  validateRequest({ body: createBodySchema }),
  permissionMiddleware([routePermissions.createMealRosterEntry]),
  asyncHandler(createMealRosterEntryController),
);

mealRosterRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: patchBodySchema }),
  permissionMiddleware([routePermissions.patchMealRosterEntry]),
  asyncHandler(patchMealRosterEntryController),
);

mealRosterRouter.delete(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  permissionMiddleware([routePermissions.deleteMealRosterEntry]),
  asyncHandler(deleteMealRosterEntryController),
);

export { mealRosterRouter };
