import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { effectiveUnitScopeMiddleware } from "../../middlewares/effective-unit-scope.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { unitDataScopeMiddleware } from "../../middlewares/unit-data-scope.middleware.js";
import { DATA_SCOPE_KINDS } from "../../shared/data-scope/data-scope.registry.js";
import {
  createCatalogController,
  deleteCatalogController,
  deleteMenuDishController,
  getCatalogController,
  getMenuController,
  importCatalogController,
  listCatalogController,
  monthMarkersController,
  putMenuController,
  updateCatalogController,
  listReceiptSlipsController,
  getReceiptSlipByDayController,
  upsertReceiptSlipUnitSelfController,
  getReceiptSlipController,
  createReceiptSlipController,
  updateReceiptSlipController,
  deleteReceiptSlipController,
  nextReceiptSlipSerialController,
  resolveReceiptLineController,
  guaranteeFromIssueController,
} from "./kitchen-books.controller.js";
import { KITCHEN_BOOKS_ROUTE_DEFINITIONS } from "./kitchen-books.route-definitions.js";
import {
  catalogIdParamsSchema,
  catalogIdQuerySchema,
  catalogListQuerySchema,
  createCatalogBodySchema,
  deleteDishQuerySchema,
  dishIdParamsSchema,
  importCatalogBodySchema,
  menuQuerySchema,
  monthMarkersQuerySchema,
  putMenuBodySchema,
  updateCatalogBodySchema,
  receiptSlipListQuerySchema,
  receiptSlipIdParamsSchema,
  receiptSlipSerialQuerySchema,
  receiptSlipByDayQuerySchema,
  resolveReceiptLineQuerySchema,
  createReceiptSlipBodySchema,
  updateReceiptSlipBodySchema,
  upsertReceiptSlipUnitSelfBodySchema,
} from "./kitchen-books.validator.js";

const kitchenBooksRouter = express.Router();
const LTTP_COMM = DATA_SCOPE_KINDS.LTTP_COMMODITY.code;

const routePermissions = Object.fromEntries(
  KITCHEN_BOOKS_ROUTE_DEFINITIONS.map((d) => [d.key, d.permission.code]),
);

const dataScopeMw = unitDataScopeMiddleware({
  dataKind: LTTP_COMM,
  asOfQueryKeys: ["date", "receiptDate"],
});

kitchenBooksRouter.use(authMiddleware);
kitchenBooksRouter.use(unitScopeMiddleware);
kitchenBooksRouter.use(effectiveUnitScopeMiddleware);

kitchenBooksRouter.get(
  "/catalog",
  dataScopeMw,
  validateRequest({ query: catalogListQuerySchema }),
  permissionMiddleware([routePermissions.listKitchenCatalog]),
  asyncHandler(listCatalogController),
);

kitchenBooksRouter.get(
  "/catalog/:id",
  dataScopeMw,
  validateRequest({ params: catalogIdParamsSchema, query: catalogIdQuerySchema }),
  permissionMiddleware([routePermissions.getKitchenCatalog]),
  asyncHandler(getCatalogController),
);

kitchenBooksRouter.post(
  "/catalog",
  dataScopeMw,
  validateRequest({ body: createCatalogBodySchema }),
  permissionMiddleware([routePermissions.createKitchenCatalog]),
  asyncHandler(createCatalogController),
);

kitchenBooksRouter.put(
  "/catalog/:id",
  dataScopeMw,
  validateRequest({ params: catalogIdParamsSchema, body: updateCatalogBodySchema }),
  permissionMiddleware([routePermissions.updateKitchenCatalog]),
  asyncHandler(updateCatalogController),
);

kitchenBooksRouter.delete(
  "/catalog/:id",
  dataScopeMw,
  validateRequest({ params: catalogIdParamsSchema, query: catalogIdQuerySchema }),
  permissionMiddleware([routePermissions.deleteKitchenCatalog]),
  asyncHandler(deleteCatalogController),
);

kitchenBooksRouter.get(
  "/menu",
  dataScopeMw,
  validateRequest({ query: menuQuerySchema }),
  permissionMiddleware([routePermissions.getKitchenMenu]),
  asyncHandler(getMenuController),
);

kitchenBooksRouter.put(
  "/menu",
  dataScopeMw,
  validateRequest({ body: putMenuBodySchema }),
  permissionMiddleware([routePermissions.putKitchenMenu]),
  asyncHandler(putMenuController),
);

kitchenBooksRouter.post(
  "/menu/import-catalog",
  dataScopeMw,
  validateRequest({ body: importCatalogBodySchema }),
  permissionMiddleware([routePermissions.importKitchenCatalogToMenu]),
  asyncHandler(importCatalogController),
);

kitchenBooksRouter.get(
  "/menu/month-markers",
  dataScopeMw,
  validateRequest({ query: monthMarkersQuerySchema }),
  permissionMiddleware([routePermissions.kitchenMenuMonthMarkers]),
  asyncHandler(monthMarkersController),
);

kitchenBooksRouter.delete(
  "/menu/dish/:dishId",
  dataScopeMw,
  validateRequest({ params: dishIdParamsSchema, query: deleteDishQuerySchema }),
  permissionMiddleware([routePermissions.deleteKitchenMenuDish]),
  asyncHandler(deleteMenuDishController),
);

kitchenBooksRouter.get(
  "/receipt-slips/next-serial",
  dataScopeMw,
  validateRequest({ query: receiptSlipSerialQuerySchema }),
  permissionMiddleware([routePermissions.nextKitchenReceiptSlipSerial]),
  asyncHandler(nextReceiptSlipSerialController),
);

kitchenBooksRouter.get(
  "/receipt-slips/resolve",
  dataScopeMw,
  validateRequest({ query: resolveReceiptLineQuerySchema }),
  permissionMiddleware([routePermissions.resolveKitchenReceiptLine]),
  asyncHandler(resolveReceiptLineController),
);

kitchenBooksRouter.get(
  "/receipt-slips/guarantee-from-issue",
  dataScopeMw,
  validateRequest({ query: receiptSlipSerialQuerySchema }),
  permissionMiddleware([routePermissions.kitchenReceiptGuaranteeFromIssue]),
  asyncHandler(guaranteeFromIssueController),
);

kitchenBooksRouter.get(
  "/receipt-slips/by-day",
  dataScopeMw,
  validateRequest({ query: receiptSlipByDayQuerySchema }),
  permissionMiddleware([routePermissions.getKitchenReceiptSlipByDay]),
  asyncHandler(getReceiptSlipByDayController),
);

kitchenBooksRouter.put(
  "/receipt-slips/by-day",
  dataScopeMw,
  validateRequest({ body: upsertReceiptSlipUnitSelfBodySchema }),
  permissionMiddleware([routePermissions.upsertKitchenReceiptUnitSelf]),
  asyncHandler(upsertReceiptSlipUnitSelfController),
);

kitchenBooksRouter.get(
  "/receipt-slips",
  dataScopeMw,
  validateRequest({ query: receiptSlipListQuerySchema }),
  permissionMiddleware([routePermissions.listKitchenReceiptSlips]),
  asyncHandler(listReceiptSlipsController),
);

kitchenBooksRouter.post(
  "/receipt-slips",
  dataScopeMw,
  validateRequest({ body: createReceiptSlipBodySchema }),
  permissionMiddleware([routePermissions.createKitchenReceiptSlip]),
  asyncHandler(createReceiptSlipController),
);

kitchenBooksRouter.get(
  "/receipt-slips/:id",
  dataScopeMw,
  validateRequest({ params: receiptSlipIdParamsSchema }),
  permissionMiddleware([routePermissions.getKitchenReceiptSlip]),
  asyncHandler(getReceiptSlipController),
);

kitchenBooksRouter.patch(
  "/receipt-slips/:id",
  dataScopeMw,
  validateRequest({ params: receiptSlipIdParamsSchema, body: updateReceiptSlipBodySchema }),
  permissionMiddleware([routePermissions.updateKitchenReceiptSlip]),
  asyncHandler(updateReceiptSlipController),
);

kitchenBooksRouter.delete(
  "/receipt-slips/:id",
  dataScopeMw,
  validateRequest({ params: receiptSlipIdParamsSchema }),
  permissionMiddleware([routePermissions.deleteKitchenReceiptSlip]),
  asyncHandler(deleteReceiptSlipController),
);

export { kitchenBooksRouter };
