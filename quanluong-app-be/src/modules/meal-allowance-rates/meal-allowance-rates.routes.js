import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  createMealAllowanceRateController,
  deleteMealAllowanceRateController,
  listMealAllowanceRatesController,
  patchMealAllowanceRateController,
} from "./meal-allowance-rates.controller.js";
import { PERMISSIONS } from "../../shared/constants/permissions.js";
import {
  createMealAllowanceRateBodySchema,
  idParamSchema,
  patchMealAllowanceRateBodySchema,
} from "./meal-allowance-rates.validator.js";

const mealAllowanceRatesRouter = express.Router();

mealAllowanceRatesRouter.use(authMiddleware);

mealAllowanceRatesRouter.get(
  "/",
  permissionMiddleware([]),
  asyncHandler(listMealAllowanceRatesController),
);

mealAllowanceRatesRouter.post(
  "/",
  validateRequest({ body: createMealAllowanceRateBodySchema }),
  permissionMiddleware([PERMISSIONS.MEAL_ALLOWANCE_RATES_MANAGE]),
  superadminMiddleware,
  asyncHandler(createMealAllowanceRateController),
);

mealAllowanceRatesRouter.patch(
  "/:id",
  validateRequest({ params: idParamSchema, body: patchMealAllowanceRateBodySchema }),
  permissionMiddleware([PERMISSIONS.MEAL_ALLOWANCE_RATES_MANAGE]),
  superadminMiddleware,
  asyncHandler(patchMealAllowanceRateController),
);

mealAllowanceRatesRouter.delete(
  "/:id",
  validateRequest({ params: idParamSchema }),
  permissionMiddleware([PERMISSIONS.MEAL_ALLOWANCE_RATES_MANAGE]),
  superadminMiddleware,
  asyncHandler(deleteMealAllowanceRateController),
);

export { mealAllowanceRatesRouter };
