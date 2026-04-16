import { config } from "../templates/config.js";

function printRuntimeConfig() {
  return {
    env: config.app.env,
    port: config.app.port,
    hasRedis: Boolean(config.redis.url),
    corsOrigins: config.security.corsOrigins,
  };
}

export { printRuntimeConfig };
