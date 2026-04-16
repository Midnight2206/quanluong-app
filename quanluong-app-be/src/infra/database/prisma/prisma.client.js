import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { config } from "../../../config/config.js";

function createMariaDbAdapter() {
  const connectionUrl = new URL(config.db.url);

  return new PrismaMariaDb({
    host: connectionUrl.hostname,
    port: Number(connectionUrl.port || 3306),
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    database: connectionUrl.pathname.replace(/^\//, ""),
  });
}

const prisma = new PrismaClient({
  adapter: createMariaDbAdapter(),
});

export { prisma };
