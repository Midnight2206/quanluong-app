import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app/app.js";
import { config } from "./config/config.js";
import { registerChatSocket } from "./modules/chat/chat.socket.js";
import { assertProductionEnvSafety } from "./config/validate-production-env.js";
import { ROUTE_PERMISSION_DEFINITIONS } from "./app/route-permissions.js";
import { registerSchedule } from "./infra/schedule/scheduler.js";
import { createRedisSessionStore } from "./infra/session/redis-session.store.js";
import { REFRESH_TOKEN_CLEANUP_SCHEDULE } from "./modules/auth/auth.constants.js";
import { bootstrapAuthSystem, cleanupExpiredRefreshTokens } from "./modules/auth/auth.service.js";
import { logger } from "./shared/utils/logger.js";

async function bootstrapServer() {
  assertProductionEnvSafety();

  const sessionStore = await createRedisSessionStore();
  if (!sessionStore) {
    logger.warn(
      "Session store is in-memory (REDIS_URL unset); sessions are lost on process restart — expect 401 until re-login",
    );
  }

  if (config.google.clientId && config.google.redirectUri) {
    logger.info(
      { googleOAuthRedirectUri: config.google.redirectUri },
      "Google OAuth redirect URI (GOOGLE_REDIRECT_URI) — copy into GCP Authorized redirect URIs byte-for-byte; Error 400 redirect_uri_mismatch if mismatch",
    );
  }

  const app = createApp({ sessionStore: sessionStore ?? undefined });
  const apiServer = http.createServer(app);

  const socketCors = {
    origin: config.security.corsOrigins,
    credentials: true,
  };

  if (config.socket.useDedicatedServer) {
    const socketOnly = http.createServer((_req, res) => {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Socket.io only — use /socket.io");
    });
    const io = new Server(socketOnly, {
      path: "/socket.io",
      cors: socketCors,
    });
    registerChatSocket(io);
    socketOnly.listen(config.socket.port, () => {
      logger.info(
        { port: config.socket.port },
        "Socket.io dedicated listener (tách luồng khỏi REST)",
      );
    });
  } else {
    const io = new Server(apiServer, {
      path: "/socket.io",
      cors: socketCors,
    });
    registerChatSocket(io);
  }

  await bootstrapAuthSystem(ROUTE_PERMISSION_DEFINITIONS);

  registerSchedule(
    REFRESH_TOKEN_CLEANUP_SCHEDULE,
    async () => {
      const deletedCount = await cleanupExpiredRefreshTokens();
      logger.info({ deletedCount }, "Expired refresh tokens cleaned");
    },
    {
      name: "refresh-token-cleanup",
    },
  );

  apiServer.listen(config.app.port, () => {
    logger.info(
      {
        port: config.app.port,
        socketDedicated: config.socket.useDedicatedServer,
        socketPort: config.socket.useDedicatedServer ? config.socket.port : config.app.port,
        env: config.app.env,
      },
      config.socket.useDedicatedServer
        ? "REST API started (Socket.io on separate port)"
        : "REST API + Socket.io on same port",
    );
  });
}

bootstrapServer().catch((error) => {
  logger.error({ err: error }, "Server bootstrap failed");
  process.exit(1);
});
