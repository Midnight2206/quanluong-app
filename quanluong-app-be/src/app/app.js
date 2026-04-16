import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import session from "express-session";
import pinoHttp from "pino-http";
import { config } from "../config/config.js";
import { router } from "./routes.js";
import { requestContextMiddleware } from "../middlewares/request-context.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import { logger } from "../shared/utils/logger.js";

/**
 * @param {object} [options]
 * @param {import("express-session").Store} [options.sessionStore]
 */
function createApp(options = {}) {
  const { sessionStore } = options;
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.security.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin is not allowed by CORS policy."));
      },
      credentials: true,
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        const p = req.path ?? "";
        return p.startsWith("/socket.io");
      },
    }),
  );

  app.use(requestContextMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps(req) {
        return {
          requestId: req.requestId,
        };
      },
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  const avatarsDir = path.join(config.media.root, "avatars");
  fs.mkdirSync(avatarsDir, { recursive: true });
  fs.mkdirSync(path.join(config.media.root, "staging"), { recursive: true });
  app.use(
    `${config.media.publicPath}/avatars`,
    express.static(avatarsDir, { index: false, fallthrough: false }),
  );

  const sessionOptions = {
    name: config.auth.sessionCookieName,
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.app.isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };
  if (sessionStore) {
    sessionOptions.store = sessionStore;
  }
  app.use(session(sessionOptions));

  app.use("/api", router);
  app.use(errorMiddleware);

  return app;
}

export { createApp };
