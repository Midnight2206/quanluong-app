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
  listMenuSamplesController,
  createMenuSampleController,
  updateMenuSampleController,
  deleteMenuSampleController,
  applyMenuSampleController,
  getCatalogController,
  getMenuController,
  getMenuDetailController,
  suggestMenuAiController,
  applyMenuAiController,
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
import {
  balanceLedgerController,
  exportLedgerMonthPdfController,
  getLedgerController,
  getLedgerSettingsController,
  lockLedgerController,
  saveLedgerController,
  saveLedgerSettingsController,
  syncLedgerSlipController,
  unlockLedgerController,
} from "./kitchen-ledger.controller.js";
import {
  addAssistantMemoryController,
  applyAssistantController,
  deleteAssistantMemoryController,
  deleteAssistantRuleController,
  getAssistantController,
  postAssistantTurnController,
  saveAssistantProfileController,
} from "./kitchen-ledger-assistant.controller.js";
import { KITCHEN_BOOKS_ROUTE_DEFINITIONS } from "./kitchen-books.route-definitions.js";
import { ledgerAiExtractRateLimit, menuAiSuggestRateLimit } from "../../middlewares/menu-ai-rate-limit.middleware.js";
import {
  catalogIdParamsSchema,
  catalogIdQuerySchema,
  catalogListQuerySchema,
  createCatalogBodySchema,
  deleteDishQuerySchema,
  dishIdParamsSchema,
  importCatalogBodySchema,
  menuSamplesListQuerySchema,
  menuSampleBodySchema,
  menuSampleIdParamsSchema,
  applyMenuSampleBodySchema,
  menuQuerySchema,
  monthMarkersQuerySchema,
  putMenuBodySchema,
  aiSuggestBodySchema,
  aiApplyBodySchema,
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
import {
  balanceLedgerBodySchema,
  ledgerMonthQuerySchema,
  ledgerQuerySchema,
  ledgerSettingsQuerySchema,
  lockLedgerBodySchema,
  saveLedgerBodySchema,
  saveLedgerSettingsBodySchema,
  syncLedgerSlipBodySchema,
  unlockLedgerBodySchema,
} from "./kitchen-ledger.validator.js";
import {
  assistantApplyBodySchema,
  assistantMemoryBodySchema,
  assistantMemoryDeleteSchema,
  assistantProfileBodySchema,
  assistantQuerySchema,
  assistantRuleDeleteSchema,
  assistantTurnBodySchema,
} from "./kitchen-ledger-assistant.validator.js";

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

kitchenBooksRouter.get(
  "/menu/detail",
  dataScopeMw,
  validateRequest({ query: menuQuerySchema }),
  permissionMiddleware([routePermissions.getKitchenMenuDetail]),
  asyncHandler(getMenuDetailController),
);

kitchenBooksRouter.post(
  "/menu/ai-suggest",
  dataScopeMw,
  validateRequest({ body: aiSuggestBodySchema }),
  permissionMiddleware([routePermissions.suggestKitchenMenuAi]),
  menuAiSuggestRateLimit,
  asyncHandler(suggestMenuAiController),
);

kitchenBooksRouter.post(
  "/menu/ai-apply",
  dataScopeMw,
  validateRequest({ body: aiApplyBodySchema }),
  permissionMiddleware([routePermissions.applyKitchenMenuAi]),
  asyncHandler(applyMenuAiController),
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
  "/menu-samples",
  dataScopeMw,
  validateRequest({ query: menuSamplesListQuerySchema }),
  permissionMiddleware([routePermissions.listKitchenMenuSamples]),
  asyncHandler(listMenuSamplesController),
);

kitchenBooksRouter.post(
  "/menu-samples",
  dataScopeMw,
  validateRequest({ body: menuSampleBodySchema }),
  permissionMiddleware([routePermissions.createKitchenMenuSample]),
  asyncHandler(createMenuSampleController),
);

kitchenBooksRouter.put(
  "/menu-samples/:id",
  dataScopeMw,
  validateRequest({ params: menuSampleIdParamsSchema, body: menuSampleBodySchema }),
  permissionMiddleware([routePermissions.updateKitchenMenuSample]),
  asyncHandler(updateMenuSampleController),
);

kitchenBooksRouter.delete(
  "/menu-samples/:id",
  dataScopeMw,
  validateRequest({ params: menuSampleIdParamsSchema, query: catalogIdQuerySchema }),
  permissionMiddleware([routePermissions.deleteKitchenMenuSample]),
  asyncHandler(deleteMenuSampleController),
);

kitchenBooksRouter.post(
  "/menu-samples/:id/apply",
  dataScopeMw,
  validateRequest({ params: menuSampleIdParamsSchema, body: applyMenuSampleBodySchema }),
  permissionMiddleware([routePermissions.applyKitchenMenuSample]),
  asyncHandler(applyMenuSampleController),
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

kitchenBooksRouter.get(
  "/ledger/settings",
  dataScopeMw,
  validateRequest({ query: ledgerSettingsQuerySchema }),
  permissionMiddleware([routePermissions.getKitchenLedgerSettings]),
  asyncHandler(getLedgerSettingsController),
);

kitchenBooksRouter.put(
  "/ledger/settings",
  dataScopeMw,
  validateRequest({ body: saveLedgerSettingsBodySchema }),
  permissionMiddleware([routePermissions.saveKitchenLedgerSettings]),
  asyncHandler(saveLedgerSettingsController),
);

kitchenBooksRouter.get(
  "/ledger/month-pdf",
  dataScopeMw,
  validateRequest({ query: ledgerMonthQuerySchema }),
  permissionMiddleware([routePermissions.exportKitchenLedgerMonthPdf]),
  asyncHandler(exportLedgerMonthPdfController),
);

kitchenBooksRouter.get(
  "/ledger",
  dataScopeMw,
  validateRequest({ query: ledgerQuerySchema }),
  permissionMiddleware([routePermissions.getKitchenLedger]),
  asyncHandler(getLedgerController),
);

kitchenBooksRouter.put(
  "/ledger",
  dataScopeMw,
  validateRequest({ body: saveLedgerBodySchema }),
  permissionMiddleware([routePermissions.saveKitchenLedger]),
  asyncHandler(saveLedgerController),
);

kitchenBooksRouter.post(
  "/ledger/lock",
  dataScopeMw,
  validateRequest({ body: lockLedgerBodySchema }),
  permissionMiddleware([routePermissions.lockKitchenLedger]),
  asyncHandler(lockLedgerController),
);

kitchenBooksRouter.post(
  "/ledger/unlock",
  dataScopeMw,
  validateRequest({ body: unlockLedgerBodySchema }),
  permissionMiddleware([routePermissions.unlockKitchenLedger]),
  asyncHandler(unlockLedgerController),
);

kitchenBooksRouter.get(
  "/ledger/assistant",
  dataScopeMw,
  validateRequest({ query: assistantQuerySchema }),
  permissionMiddleware([routePermissions.getKitchenLedgerAssistant]),
  asyncHandler(getAssistantController),
);

kitchenBooksRouter.post(
  "/ledger/assistant/turn",
  dataScopeMw,
  ledgerAiExtractRateLimit,
  validateRequest({ body: assistantTurnBodySchema }),
  permissionMiddleware([routePermissions.postKitchenLedgerAssistantTurn]),
  asyncHandler(postAssistantTurnController),
);

kitchenBooksRouter.post(
  "/ledger/assistant/apply",
  dataScopeMw,
  validateRequest({ body: assistantApplyBodySchema }),
  permissionMiddleware([routePermissions.applyKitchenLedgerAssistant]),
  asyncHandler(applyAssistantController),
);

kitchenBooksRouter.put(
  "/ledger/assistant/profile",
  dataScopeMw,
  validateRequest({ body: assistantProfileBodySchema }),
  permissionMiddleware([routePermissions.saveKitchenLedgerAssistantProfile]),
  asyncHandler(saveAssistantProfileController),
);

kitchenBooksRouter.post(
  "/ledger/assistant/memory",
  dataScopeMw,
  validateRequest({ body: assistantMemoryBodySchema }),
  permissionMiddleware([routePermissions.addKitchenLedgerAssistantMemory]),
  asyncHandler(addAssistantMemoryController),
);

kitchenBooksRouter.delete(
  "/ledger/assistant/memory",
  dataScopeMw,
  validateRequest({ query: assistantMemoryDeleteSchema }),
  permissionMiddleware([routePermissions.deleteKitchenLedgerAssistantMemory]),
  asyncHandler(deleteAssistantMemoryController),
);

kitchenBooksRouter.delete(
  "/ledger/assistant/rules",
  dataScopeMw,
  validateRequest({ query: assistantRuleDeleteSchema }),
  permissionMiddleware([routePermissions.deleteKitchenLedgerAssistantRule]),
  asyncHandler(deleteAssistantRuleController),
);

kitchenBooksRouter.post(
  "/ledger/balance",
  dataScopeMw,
  validateRequest({ body: balanceLedgerBodySchema }),
  permissionMiddleware([routePermissions.balanceKitchenLedger]),
  asyncHandler(balanceLedgerController),
);

kitchenBooksRouter.post(
  "/ledger/slip-sync",
  dataScopeMw,
  validateRequest({ body: syncLedgerSlipBodySchema }),
  permissionMiddleware([routePermissions.syncKitchenLedgerSlip]),
  asyncHandler(syncLedgerSlipController),
);

export { kitchenBooksRouter };
