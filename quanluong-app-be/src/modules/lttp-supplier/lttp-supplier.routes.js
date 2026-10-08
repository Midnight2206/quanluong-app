import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import {
  getLttpSupplierCatalogController,
  getLttpSupplierLinksController,
  getLttpSupplierLinksForUserController,
  getLttpSupplierOrdersController,
} from "./lttp-supplier.controller.js";
import { lttpSupplierMiddleware } from "./lttp-supplier.middleware.js";
import { ordersQuerySchema, userLinksParamsSchema } from "./lttp-supplier.validator.js";

const lttpSupplierRouter = express.Router();

lttpSupplierRouter.get(
  "/catalog",
  authMiddleware,
  superadminMiddleware,
  asyncHandler(getLttpSupplierCatalogController),
);

lttpSupplierRouter.get(
  "/users/:userId/links",
  authMiddleware,
  superadminMiddleware,
  validateRequest({ params: userLinksParamsSchema }),
  asyncHandler(getLttpSupplierLinksForUserController),
);

lttpSupplierRouter.get(
  "/links",
  authMiddleware,
  lttpSupplierMiddleware,
  asyncHandler(getLttpSupplierLinksController),
);

lttpSupplierRouter.get(
  "/orders",
  authMiddleware,
  lttpSupplierMiddleware,
  validateRequest({ query: ordersQuerySchema }),
  asyncHandler(getLttpSupplierOrdersController),
);

export { lttpSupplierRouter };
