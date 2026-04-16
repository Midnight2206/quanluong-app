import logger from "./logger.js";
import { buildRequestLogContext } from "./log-context.js";

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  const context = buildRequestLogContext(req);

  logger.info("Request started", context);

  res.on("finish", () => {
    logger.info("Request completed", {
      ...context,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}

export { requestLogger };
