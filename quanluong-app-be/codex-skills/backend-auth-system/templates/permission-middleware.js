export const requirePermission =
  (permission) =>
  (req, _res, next) => {
    try {
      const permissions = req.auth?.permissions ?? [];

      if (!permissions.includes(permission)) {
        const error = new Error("Access denied.");
        error.code = "FORBIDDEN";
        error.status = 403;
        throw error;
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
