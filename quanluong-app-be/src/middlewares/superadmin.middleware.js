import { AppError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";

function superadminMiddleware(req, _res, next) {
  const u = req.user;
  if (u?.type?.name !== "superadmin") {
    return next(
      new AppError({
        message: "Chỉ superadmin được thao tác này.",
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
      }),
    );
  }
  return next();
}

export { superadminMiddleware };
