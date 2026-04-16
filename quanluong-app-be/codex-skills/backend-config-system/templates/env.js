import { requireEnv } from "./require-env.js";

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL || "",
  jwtSecret: requireEnv("JWT_ACCESS_SECRET"),
  sessionSecret: requireEnv("SESSION_SECRET"),
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
};

export { env };
