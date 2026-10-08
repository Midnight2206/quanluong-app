import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { LTTP_SUPPLIER_TYPE_NAME } from "./lttp-supplier.links.js";

function lttpSupplierMiddleware(req, _res, next) {
  if (req.user?.type?.name !== LTTP_SUPPLIER_TYPE_NAME) {
    return next(new AppError({
      message: "Chỉ tài khoản nhà cung cấp được thao tác này.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    }));
  }

  return next();
}

export { lttpSupplierMiddleware };
