import { env } from "./env.js";

const config = {
  app: {
    env: env.nodeEnv,
    port: env.port,
  },
  db: {
    url: env.databaseUrl,
  },
  redis: {
    url: env.redisUrl,
  },
  auth: {
    jwtSecret: env.jwtSecret,
    sessionSecret: env.sessionSecret,
  },
  security: {
    corsOrigins: env.corsOrigins,
  },
};

export { config };
