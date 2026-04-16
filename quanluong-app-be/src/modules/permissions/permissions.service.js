import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const CATALOG_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  module: true,
  method: true,
  pathRoute: true,
};

async function listPermissionsCatalog() {
  return prisma.permission.findMany({
    select: CATALOG_SELECT,
    orderBy: [{ module: "asc" }, { code: "asc" }],
  });
}

async function patchPermissionDescription(permissionId, { description }) {
  const existing = await prisma.permission.findUnique({
    where: { id: permissionId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError({
      message: "Permission was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  return prisma.permission.update({
    where: { id: permissionId },
    data: {
      description: description === null ? null : description,
    },
    select: CATALOG_SELECT,
  });
}

export { listPermissionsCatalog, patchPermissionDescription };
