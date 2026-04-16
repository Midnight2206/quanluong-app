import logger from "../templates/logger.js";
import { buildRequestLogContext } from "../templates/log-context.js";

async function getUserController(req, res, next) {
  try {
    logger.info("Get user requested", buildRequestLogContext(req));
    res.json({ ok: true });
  } catch (error) {
    logger.error("Get user failed", {
      ...buildRequestLogContext(req),
      errorMessage: error.message,
    });
    next(error);
  }
}

export { getUserController };
