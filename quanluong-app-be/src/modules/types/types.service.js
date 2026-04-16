import { prisma } from "../../infra/database/prisma/prisma.client.js";

async function listTypes() {
  return prisma.type.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
    },
  });
}

export { listTypes };
