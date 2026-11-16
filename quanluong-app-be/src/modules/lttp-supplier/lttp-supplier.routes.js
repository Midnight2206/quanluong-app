import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import {
  getLttpSupplierCatalogController,
  getLttpSupplierDailyInvoiceController,
  getLttpSupplierDebtController,
  getLttpSupplierLinksController,
  getLttpSupplierLinksForUserController,
  getLttpSupplierLedgerController,
  getLttpSupplierMeController,
  getLttpSupplierOrdersController,
  patchLttpSupplierMeController,
  printLttpSupplierDailyInvoiceController,
} from "./lttp-supplier.controller.js";
import { lttpSupplierMiddleware } from "./lttp-supplier.middleware.js";
import {
  dailyInvoiceQuerySchema,
  ledgerQuerySchema,
  meQuerySchema,
  ordersQuerySchema,
  patchMeBodySchema,
  userLinksParamsSchema,
} from "./lttp-supplier.validator.js";

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
  "/me",
  authMiddleware,
  lttpSupplierMiddleware,
  validateRequest({ query: meQuerySchema }),
  asyncHandler(getLttpSupplierMeController),
);

lttpSupplierRouter.patch(
  "/me",
  authMiddleware,
  lttpSupplierMiddleware,
  validateRequest({ query: meQuerySchema, body: patchMeBodySchema }),
  asyncHandler(patchLttpSupplierMeController),
);

lttpSupplierRouter.get(
  "/ledger",
  authMiddleware,
  lttpSupplierMiddleware,
  validateRequest({ query: ledgerQuerySchema }),
  asyncHandler(getLttpSupplierLedgerController),
);

lttpSupplierRouter.get(
  "/orders",
  authMiddleware,
  lttpSupplierMiddleware,
  validateRequest({ query: ordersQuerySchema }),
  asyncHandler(getLttpSupplierOrdersController),
);

lttpSupplierRouter.get(
  "/daily-invoice",
  authMiddleware,
  lttpSupplierMiddleware,
  validateRequest({ query: dailyInvoiceQuerySchema }),
  asyncHandler(getLttpSupplierDailyInvoiceController),
);

lttpSupplierRouter.get(
  "/daily-invoice/print-pdf",
  authMiddleware,
  lttpSupplierMiddleware,
  validateRequest({ query: dailyInvoiceQuerySchema }),
  asyncHandler(printLttpSupplierDailyInvoiceController),
);

lttpSupplierRouter.get(
  "/debt",
  authMiddleware,
  lttpSupplierMiddleware,
  validateRequest({ query: meQuerySchema }),
  asyncHandler(getLttpSupplierDebtController),
);

export { lttpSupplierRouter };
