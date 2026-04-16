import express from "express";
import multer from "multer";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { effectiveUnitScopeMiddleware } from "../../middlewares/effective-unit-scope.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { unitDataScopeMiddleware } from "../../middlewares/unit-data-scope.middleware.js";
import { DATA_SCOPE_KINDS } from "../../shared/data-scope/data-scope.registry.js";
import {
  applyLttpCommodityToUnitController,
  applyLttpPriceTableToUnitController,
  createCommodityController,
  createFoodGroupController,
  createPriceTableController,
  deleteCommodityController,
  deleteFoodGroupController,
  deletePriceTableController,
  downloadPriceImportTemplateController,
  effectivePricesController,
  getCommodityController,
  getPriceTableController,
  importPriceTableController,
  listCommoditiesController,
  listFoodGroupsCatalogController,
  listFoodGroupsController,
  listPriceTablesController,
  patchCommodityController,
  patchFoodGroupController,
  patchPriceTableController,
} from "./lttp.controller.js";
import { LTTP_ROUTE_DEFINITIONS } from "./lttp.route-definitions.js";
import {
  applyLttpPriceTableToUnitBodySchema,
  applyLttpToUnitBodySchema,
  commodityParamsSchema,
  commodityQuerySchema,
  createCommodityBodySchema,
  createFoodGroupBodySchema,
  createPriceTableBodySchema,
  effectiveQuerySchema,
  foodGroupIdParamsSchema,
  listPriceTablesQuerySchema,
  patchCommodityBodySchema,
  patchFoodGroupBodySchema,
  patchPriceTableBodySchema,
  priceTableParamsSchema,
} from "./lttp.validator.js";

const lttpRouter = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const routePermissions = Object.fromEntries(
  LTTP_ROUTE_DEFINITIONS.map((d) => [d.key, d.permission.code]),
);

const LTTP_GROUP = DATA_SCOPE_KINDS.LTTP_FOOD_GROUP.code;
const LTTP_COMM = DATA_SCOPE_KINDS.LTTP_COMMODITY.code;
const LTTP_PRICE = DATA_SCOPE_KINDS.LTTP_PRICE_TABLE.code;

lttpRouter.use(authMiddleware);
lttpRouter.use(unitScopeMiddleware);
lttpRouter.use(effectiveUnitScopeMiddleware);

lttpRouter.get(
  "/food-groups/catalog",
  unitDataScopeMiddleware({ dataKind: LTTP_GROUP }),
  permissionMiddleware([routePermissions.foodGroupsCatalog]),
  superadminMiddleware,
  asyncHandler(listFoodGroupsCatalogController),
);

lttpRouter.get(
  "/food-groups",
  unitDataScopeMiddleware({ dataKind: LTTP_GROUP }),
  permissionMiddleware([routePermissions.listFoodGroups]),
  asyncHandler(listFoodGroupsController),
);

lttpRouter.post(
  "/food-groups",
  validateRequest({ body: createFoodGroupBodySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_GROUP }),
  permissionMiddleware([routePermissions.createFoodGroup]),
  superadminMiddleware,
  asyncHandler(createFoodGroupController),
);

lttpRouter.patch(
  "/food-groups/:id",
  validateRequest({
    params: foodGroupIdParamsSchema,
    body: patchFoodGroupBodySchema,
  }),
  unitDataScopeMiddleware({ dataKind: LTTP_GROUP }),
  permissionMiddleware([routePermissions.patchFoodGroup]),
  superadminMiddleware,
  asyncHandler(patchFoodGroupController),
);

lttpRouter.delete(
  "/food-groups/:id",
  validateRequest({ params: foodGroupIdParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_GROUP }),
  permissionMiddleware([routePermissions.deleteFoodGroup]),
  superadminMiddleware,
  asyncHandler(deleteFoodGroupController),
);

lttpRouter.get(
  "/prices/effective",
  validateRequest({ query: effectiveQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_PRICE, asOfQueryKeys: ["date"] }),
  permissionMiddleware([routePermissions.effectivePrices]),
  asyncHandler(effectivePricesController),
);

lttpRouter.get(
  "/commodities",
  validateRequest({ query: commodityQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.listCommodities]),
  asyncHandler(listCommoditiesController),
);

lttpRouter.post(
  "/commodities/:id/apply-to-unit",
  validateRequest({
    params: commodityParamsSchema,
    body: applyLttpToUnitBodySchema,
  }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.applyLttpCommodityToUnit]),
  asyncHandler(applyLttpCommodityToUnitController),
);

lttpRouter.get(
  "/commodities/:id",
  validateRequest({ params: commodityParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.getCommodity]),
  asyncHandler(getCommodityController),
);

lttpRouter.post(
  "/commodities",
  validateRequest({ body: createCommodityBodySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.createCommodity]),
  asyncHandler(createCommodityController),
);

lttpRouter.patch(
  "/commodities/:id",
  validateRequest({
    params: commodityParamsSchema,
    body: patchCommodityBodySchema,
  }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.patchCommodity]),
  asyncHandler(patchCommodityController),
);

lttpRouter.delete(
  "/commodities/:id",
  validateRequest({ params: commodityParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.deleteCommodity]),
  asyncHandler(deleteCommodityController),
);

lttpRouter.get(
  "/price-tables",
  validateRequest({ query: listPriceTablesQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_PRICE }),
  permissionMiddleware([routePermissions.listPriceTables]),
  asyncHandler(listPriceTablesController),
);

lttpRouter.get(
  "/price-tables/import-template",
  validateRequest({ query: effectiveQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_PRICE, asOfQueryKeys: ["date"] }),
  permissionMiddleware([routePermissions.downloadPriceImportTemplate]),
  asyncHandler(downloadPriceImportTemplateController),
);

lttpRouter.post(
  "/price-tables/import",
  upload.single("file"),
  unitDataScopeMiddleware({ dataKind: LTTP_PRICE }),
  permissionMiddleware([routePermissions.importPriceTable]),
  asyncHandler(importPriceTableController),
);

lttpRouter.post(
  "/price-tables",
  validateRequest({ body: createPriceTableBodySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_PRICE }),
  permissionMiddleware([routePermissions.createPriceTable]),
  asyncHandler(createPriceTableController),
);

lttpRouter.get(
  "/price-tables/:id",
  validateRequest({ params: priceTableParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_PRICE, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.getPriceTable]),
  asyncHandler(getPriceTableController),
);

lttpRouter.patch(
  "/price-tables/:id",
  validateRequest({
    params: priceTableParamsSchema,
    body: patchPriceTableBodySchema,
  }),
  unitDataScopeMiddleware({ dataKind: LTTP_PRICE, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.patchPriceTable]),
  asyncHandler(patchPriceTableController),
);

lttpRouter.delete(
  "/price-tables/:id",
  validateRequest({ params: priceTableParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_PRICE, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.deletePriceTable]),
  asyncHandler(deletePriceTableController),
);

lttpRouter.post(
  "/price-tables/:id/apply-to-unit",
  validateRequest({
    params: priceTableParamsSchema,
    body: applyLttpPriceTableToUnitBodySchema,
  }),
  unitDataScopeMiddleware({ dataKind: LTTP_PRICE, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.applyLttpPriceTableToUnit]),
  asyncHandler(applyLttpPriceTableToUnitController),
);

export { lttpRouter };
