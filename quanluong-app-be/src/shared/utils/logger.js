import pino from "pino";
import { config } from "../../config/config.js";

const logger = pino({
  name: config.app.name,
  level: config.app.isProduction ? "info" : "debug",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "password",
    "token",
    "accessToken",
    "refreshToken",
  ],
});

export { logger };
