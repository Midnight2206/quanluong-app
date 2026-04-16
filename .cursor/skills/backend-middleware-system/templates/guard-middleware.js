export const requireAuthenticated =
  () =>
  (req, _res, next) => {
    if (!req.auth?.userId) {
      const error = new Error("Authentication required.");
      error.code = "UNAUTHENTICATED";
      error.status = 401;
      return next(error);
    }

    return next();
  };
