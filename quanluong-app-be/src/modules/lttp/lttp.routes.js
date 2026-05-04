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
  createIssueSlipController,
  createLttpSupplierController,
  createPriceTableController,
  deleteCommodityController,
  deleteFoodGroupController,
  deleteIssueSlipController,
  deleteLttpSupplierController,
  deletePriceTableController,
  downloadPriceImportTemplateController,
  effectivePricesController,
  getCommodityController,
  getIssueFormDefaultsController,
  getDailyOrderSummaryController,
  getIssueSlipController,
  getNextIssueSlipSerialController,
  getPriceTableController,
  getRecipientDefaultUserByUnitController,
  importPriceTableController,
  listCommoditiesController,
  listLttpSuppliersController,
  listFoodGroupsCatalogController,
  listFoodGroupsController,
  listIssueSlipsController,
  listPriceTablesController,
  listRecipientDefaultUsersInScopeController,
  listRecipientUsersController,
  patchCommodityController,
  patchFoodGroupController,
  patchLttpSupplierController,
  putLttpCommodityDefaultSupplierController,
  patchPriceTableController,
  putIssueFormDefaultsController,
  putRecipientDefaultUserController,
  resolveIssueSlipLineController,
  resyncIssueSlipPricesController,
  updateIssueSlipController,
} from "./lttp.controller.js";
import { LTTP_ROUTE_DEFINITIONS } from "./lttp.route-definitions.js";
import {
  applyLttpPriceTableToUnitBodySchema,
  applyLttpToUnitBodySchema,
  commodityParamsSchema,
  commodityQuerySchema,
  createCommodityBodySchema,
  createLttpSupplierBodySchema,
  createFoodGroupBodySchema,
  createIssueSlipBodySchema,
  createPriceTableBodySchema,
  effectiveQuerySchema,
  foodGroupIdParamsSchema,
  issueFormDefaultsQuerySchema,
  issueSlipIdParamsSchema,
  issueSlipResolveQuerySchema,
  dailyOrderSummaryQuerySchema,
  listIssueSlipsQuerySchema,
  listRecipientUsersQuerySchema,
  nextIssueSlipSerialQuerySchema,
  listPriceTablesQuerySchema,
  lttpSupplierQuerySchema,
  putLttpCommodityDefaultSupplierBodySchema,
  lttpSupplierParamsSchema,
  patchCommodityBodySchema,
  patchFoodGroupBodySchema,
  patchLttpSupplierBodySchema,
  patchPriceTableBodySchema,
  priceTableParamsSchema,
  putRecipientDefaultUserBodySchema,
  recipientDefaultByUnitQuerySchema,
  updateIssueSlipBodySchema,
  upsertIssueFormDefaultsBodySchema,
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
  "/issue-slips/resolve",
  validateRequest({ query: issueSlipResolveQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["date"] }),
  permissionMiddleware([routePermissions.resolveIssueSlipLine]),
  asyncHandler(resolveIssueSlipLineController),
);

lttpRouter.get(
  "/issue-slips/daily-order-summary",
  validateRequest({ query: dailyOrderSummaryQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["date"] }),
  permissionMiddleware([routePermissions.dailyOrderSummary]),
  asyncHandler(getDailyOrderSummaryController),
);

lttpRouter.get(
  "/issue-slips",
  validateRequest({ query: listIssueSlipsQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["from", "to"] }),
  permissionMiddleware([routePermissions.listIssueSlips]),
  asyncHandler(listIssueSlipsController),
);

lttpRouter.post(
  "/issue-slips",
  validateRequest({ body: createIssueSlipBodySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.createIssueSlip]),
  asyncHandler(createIssueSlipController),
);

lttpRouter.get(
  "/issue-slips/next-serial",
  validateRequest({ query: nextIssueSlipSerialQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, asOfQueryKeys: ["date"] }),
  permissionMiddleware([routePermissions.nextIssueSlipSerial]),
  asyncHandler(getNextIssueSlipSerialController),
);

lttpRouter.get(
  "/issue-form-defaults",
  validateRequest({ query: issueFormDefaultsQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.getIssueFormDefaults]),
  asyncHandler(getIssueFormDefaultsController),
);

lttpRouter.put(
  "/issue-form-defaults",
  validateRequest({ body: upsertIssueFormDefaultsBodySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.putIssueFormDefaults]),
  asyncHandler(putIssueFormDefaultsController),
);

lttpRouter.get(
  "/recipient-users",
  validateRequest({ query: listRecipientUsersQuerySchema }),
  permissionMiddleware([routePermissions.listRecipientUsers]),
  asyncHandler(listRecipientUsersController),
);

lttpRouter.get(
  "/receiving-default-recipient",
  validateRequest({ query: recipientDefaultByUnitQuerySchema }),
  permissionMiddleware([routePermissions.getRecipientDefaultUser]),
  asyncHandler(getRecipientDefaultUserByUnitController),
);

lttpRouter.get(
  "/receiving-default-recipients",
  permissionMiddleware([routePermissions.listRecipientDefaultUsers]),
  asyncHandler(listRecipientDefaultUsersInScopeController),
);

lttpRouter.put(
  "/receiving-default-recipient",
  validateRequest({ body: putRecipientDefaultUserBodySchema }),
  permissionMiddleware([routePermissions.putRecipientDefaultUser]),
  asyncHandler(putRecipientDefaultUserController),
);

lttpRouter.get(
  "/issue-slips/:id",
  validateRequest({ params: issueSlipIdParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.getIssueSlip]),
  asyncHandler(getIssueSlipController),
);

lttpRouter.post(
  "/issue-slips/:id/resync-prices",
  validateRequest({ params: issueSlipIdParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.resyncIssueSlipPrices]),
  asyncHandler(resyncIssueSlipPricesController),
);

lttpRouter.put(
  "/issue-slips/:id",
  validateRequest({ params: issueSlipIdParamsSchema, body: updateIssueSlipBodySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.updateIssueSlip]),
  asyncHandler(updateIssueSlipController),
);

lttpRouter.delete(
  "/issue-slips/:id",
  validateRequest({ params: issueSlipIdParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.deleteIssueSlip]),
  asyncHandler(deleteIssueSlipController),
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

lttpRouter.put(
  "/commodities/:id/default-lttp-supplier",
  validateRequest({
    params: commodityParamsSchema,
    body: putLttpCommodityDefaultSupplierBodySchema,
  }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.putLttpCommodityDefaultSupplier]),
  asyncHandler(putLttpCommodityDefaultSupplierController),
);

lttpRouter.delete(
  "/commodities/:id",
  validateRequest({ params: commodityParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.deleteCommodity]),
  asyncHandler(deleteCommodityController),
);

lttpRouter.get(
  "/suppliers",
  validateRequest({ query: lttpSupplierQuerySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.listLttpSuppliers]),
  asyncHandler(listLttpSuppliersController),
);

lttpRouter.post(
  "/suppliers",
  validateRequest({ body: createLttpSupplierBodySchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM }),
  permissionMiddleware([routePermissions.createLttpSupplier]),
  asyncHandler(createLttpSupplierController),
);

lttpRouter.patch(
  "/suppliers/:id",
  validateRequest({
    params: lttpSupplierParamsSchema,
    body: patchLttpSupplierBodySchema,
  }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.patchLttpSupplier]),
  asyncHandler(patchLttpSupplierController),
);

lttpRouter.delete(
  "/suppliers/:id",
  validateRequest({ params: lttpSupplierParamsSchema }),
  unitDataScopeMiddleware({ dataKind: LTTP_COMM, recordIdParam: "id" }),
  permissionMiddleware([routePermissions.deleteLttpSupplier]),
  asyncHandler(deleteLttpSupplierController),
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
