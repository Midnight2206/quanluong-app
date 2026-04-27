import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  midnightSecretMiddleware,
  midnightUserUnitMiddleware,
} from "./midnight-secret.middleware.js";
import {
  createPartnerPaymentController,
  getLttpPartnerMoneyMatrixController,
  getLttpPartnerPeriodTotalsController,
  getLttpSuppliersForMidnightController,
  getPartnerDebtSummaryController,
  getPartnerPriceEditorController,
  listPartnerPaymentsController,
  listActiveUnitsForMidnight,
  putPartnerPriceTableController,
} from "./midnight-secret.controller.js";
import {
  lttpSuppliersQuerySchema,
  lttpSupplierParamsSchema,
  partnerPaymentBodySchema,
  partnerMatrixQuerySchema,
  partnerPeriodQuerySchema,
  partnerPriceGetQuerySchema,
  partnerPricePutBodySchema,
} from "./midnight-secret.validator.js";

const midnightSecretRouter = express.Router();

midnightSecretRouter.use(midnightSecretMiddleware, midnightUserUnitMiddleware);

midnightSecretRouter.get(
  "/units",
  asyncHandler(listActiveUnitsForMidnight),
);

midnightSecretRouter.get(
  "/lttp-partner-totals",
  validateRequest({ query: partnerPeriodQuerySchema }),
  asyncHandler(getLttpPartnerPeriodTotalsController),
);

midnightSecretRouter.get(
  "/lttp-suppliers",
  validateRequest({ query: lttpSuppliersQuerySchema }),
  asyncHandler(getLttpSuppliersForMidnightController),
);

midnightSecretRouter.get(
  "/partner-prices",
  validateRequest({ query: partnerPriceGetQuerySchema }),
  asyncHandler(getPartnerPriceEditorController),
);

midnightSecretRouter.put(
  "/partner-prices",
  validateRequest({ body: partnerPricePutBodySchema }),
  asyncHandler(putPartnerPriceTableController),
);

midnightSecretRouter.get(
  "/lttp-partner-money-matrix",
  validateRequest({ query: partnerMatrixQuerySchema }),
  asyncHandler(getLttpPartnerMoneyMatrixController),
);

midnightSecretRouter.get(
  "/partner-debts",
  asyncHandler(getPartnerDebtSummaryController),
);

midnightSecretRouter.get(
  "/partner-debts/:supplierId/payments",
  validateRequest({ params: lttpSupplierParamsSchema }),
  asyncHandler(listPartnerPaymentsController),
);

midnightSecretRouter.post(
  "/partner-debts/:supplierId/payments",
  validateRequest({ params: lttpSupplierParamsSchema, body: partnerPaymentBodySchema }),
  asyncHandler(createPartnerPaymentController),
);

export { midnightSecretRouter };
