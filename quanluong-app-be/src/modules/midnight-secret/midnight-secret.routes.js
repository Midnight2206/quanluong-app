import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { PERMISSIONS } from "../../shared/constants/permissions.js";
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
import { MIDNIGHT_ROUTE_DEFINITIONS } from "./midnight-secret.route-definitions.js";
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

const routePermissions = Object.fromEntries(
  MIDNIGHT_ROUTE_DEFINITIONS.map((d) => [d.key, d.permission.code]),
);

const MIDNIGHT_TAB_READ = [
  PERMISSIONS.MIDNIGHT_PRICES_READ,
  PERMISSIONS.MIDNIGHT_MATRIX_READ,
  PERMISSIONS.MIDNIGHT_DEBTS_READ,
];

function permissionAnyMiddleware(codes) {
  return (req, _res, next) => {
    if (req.user?.type?.name === "superadmin") {
      return next();
    }
    const have = (req.user?.permissions || []).map((permission) => permission.code || permission);
    if (codes.some((code) => have.includes(code))) {
      return next();
    }
    return next(
      new AppError({
        message: "Không có quyền truy cập.",
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
      }),
    );
  };
}

/** Quyền trước, mật khẩu cổng sau. */
function guard(permissionCode) {
  return [permissionMiddleware([permissionCode]), midnightSecretMiddleware, midnightUserUnitMiddleware];
}

function guardAny(codes) {
  return [permissionAnyMiddleware(codes), midnightSecretMiddleware, midnightUserUnitMiddleware];
}

midnightSecretRouter.use(authMiddleware);

midnightSecretRouter.get(
  "/units",
  ...guardAny(MIDNIGHT_TAB_READ),
  asyncHandler(listActiveUnitsForMidnight),
);

midnightSecretRouter.get(
  "/lttp-partner-totals",
  validateRequest({ query: partnerPeriodQuerySchema }),
  ...guard(routePermissions.getMidnightPartnerTotals),
  asyncHandler(getLttpPartnerPeriodTotalsController),
);

midnightSecretRouter.get(
  "/lttp-suppliers",
  validateRequest({ query: lttpSuppliersQuerySchema }),
  ...guard(routePermissions.getMidnightSuppliers),
  asyncHandler(getLttpSuppliersForMidnightController),
);

midnightSecretRouter.get(
  "/partner-prices",
  validateRequest({ query: partnerPriceGetQuerySchema }),
  ...guard(routePermissions.getMidnightPartnerPrices),
  asyncHandler(getPartnerPriceEditorController),
);

midnightSecretRouter.put(
  "/partner-prices",
  validateRequest({ body: partnerPricePutBodySchema }),
  ...guard(routePermissions.putMidnightPartnerPrices),
  asyncHandler(putPartnerPriceTableController),
);

midnightSecretRouter.get(
  "/lttp-partner-money-matrix",
  validateRequest({ query: partnerMatrixQuerySchema }),
  ...guard(routePermissions.getMidnightMatrix),
  asyncHandler(getLttpPartnerMoneyMatrixController),
);

midnightSecretRouter.get(
  "/partner-debts",
  ...guard(routePermissions.getMidnightDebts),
  asyncHandler(getPartnerDebtSummaryController),
);

midnightSecretRouter.get(
  "/partner-debts/:supplierId/payments",
  validateRequest({ params: lttpSupplierParamsSchema }),
  ...guard(routePermissions.listMidnightPayments),
  asyncHandler(listPartnerPaymentsController),
);

midnightSecretRouter.post(
  "/partner-debts/:supplierId/payments",
  validateRequest({ params: lttpSupplierParamsSchema, body: partnerPaymentBodySchema }),
  ...guard(routePermissions.createMidnightPayment),
  asyncHandler(createPartnerPaymentController),
);

export { midnightSecretRouter };
