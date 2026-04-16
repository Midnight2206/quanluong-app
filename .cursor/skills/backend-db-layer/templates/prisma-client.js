import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

function createMariaDbAdapter() {
  const connectionUrl = new URL(process.env.DATABASE_URL);

  return new PrismaMariaDb({
    host: connectionUrl.hostname,
    port: Number(connectionUrl.port || 3306),
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    database: connectionUrl.pathname.replace(/^\//, ""),
  });
}

export const prisma = new PrismaClient({
  adapter: createMariaDbAdapter(),
});
