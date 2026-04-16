import { AppError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";

function permissionMiddleware(requiredPermissions = []) {
  return (req, _res, next) => {
    if (req.user?.type?.name === "superadmin") {
      return next();
    }

    const userPermissions = req.user?.permissions || [];
    const permissionCodes = userPermissions.map((permission) => permission.code || permission);
    const hasPermission = requiredPermissions.every((permission) =>
      permissionCodes.includes(permission),
    );

    if (!hasPermission) {
      return next(
        new AppError({
          message: "You do not have access to this resource",
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
        }),
      );
    }

    return next();
  };
}

export { permissionMiddleware };
