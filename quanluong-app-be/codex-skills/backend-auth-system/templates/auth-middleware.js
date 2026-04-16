import jwt from "jsonwebtoken";

export const authenticateRequest =
  ({ jwtSecret, sessionStore }) =>
  async (req, _res, next) => {
    try {
      const sessionId = req.cookies?.sessionId;
      const accessToken = req.cookies?.accessToken;

      if (!sessionId || !accessToken) {
        const error = new Error("Authentication required.");
        error.code = "UNAUTHENTICATED";
        error.status = 401;
        throw error;
      }

      const session = await sessionStore.findById(sessionId);

      if (!session) {
        const error = new Error("Authentication required.");
        error.code = "UNAUTHENTICATED";
        error.status = 401;
        throw error;
      }

      const payload = jwt.verify(accessToken, jwtSecret);

      req.auth = {
        userId: payload.sub,
        permissions: payload.permissions ?? [],
        sessionId,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
