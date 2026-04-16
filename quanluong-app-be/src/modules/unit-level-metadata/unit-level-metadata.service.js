import { prisma } from "../../infra/database/prisma/prisma.client.js";

async function listUnitLevelMetadata() {
  return prisma.unitLevelMetadata.findMany({
    orderBy: { depth: "asc" },
  });
}

async function upsertUnitLevelMetadata(depth, { label, description }) {
  return prisma.unitLevelMetadata.upsert({
    where: { depth },
    update: {
      label: label ?? undefined,
      description: description ?? undefined,
    },
    create: {
      depth,
      label: label ?? null,
      description: description ?? null,
    },
  });
}

export { listUnitLevelMetadata, upsertUnitLevelMetadata };
