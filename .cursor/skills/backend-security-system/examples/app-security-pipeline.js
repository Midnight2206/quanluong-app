import { createHelmetMiddleware } from "../templates/helmet.js";
import { createCorsMiddleware } from "../templates/cors.js";
import { sanitizeInput } from "../templates/sanitize-input.js";
import { authRateLimit } from "../templates/rate-limit.js";

function applySecurity(app) {
  app.use(createHelmetMiddleware());
  app.use(createCorsMiddleware());
  app.use(sanitizeInput);

  app.use("/api/auth/login", authRateLimit);
  app.use("/api/auth/forgot-password", authRateLimit);
}

export { applySecurity };
