import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import { config } from "../../config/config.js";
import { logger } from "../../shared/utils/logger.js";

/**
 * Redis-backed session store when REDIS_URL is set; otherwise callers should
 * fall back to express-session MemoryStore (sessions lost on restart).
 *
 * @returns {Promise<import("express-session").Store | null>}
 */
async function createRedisSessionStore() {
  if (!config.redis.url) {
    return null;
  }

  const client = createClient({ url: config.redis.url });
  client.on("error", (err) => {
    logger.error({ err }, "Redis session store client error");
  });

  await client.connect();

  return new RedisStore({
    client,
    prefix: "ql:sess:",
  });
}

export { createRedisSessionStore };
