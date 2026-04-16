import Redis from "ioredis";
import { config } from "../../config/config.js";

const redis = config.redis.url
  ? new Redis(config.redis.url, { maxRetriesPerRequest: null })
  : null;

export { redis };
