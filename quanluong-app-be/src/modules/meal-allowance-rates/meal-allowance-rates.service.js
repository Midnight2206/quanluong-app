import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

function mapRow(row) {
  return {
    id: row.id,
    doiTuong: row.doiTuong,
    mucTienAn: row.mucTienAn,
    type: row.type,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

async function listMealAllowanceRates() {
  const rows = await prisma.mealAllowanceRate.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  return rows.map(mapRow);
}

async function createMealAllowanceRate(payload) {
  const row = await prisma.mealAllowanceRate.create({
    data: {
      doiTuong: payload.doiTuong.trim(),
      mucTienAn: payload.mucTienAn,
      type: payload.type,
      sortOrder: payload.sortOrder ?? 0,
    },
  });
  return mapRow(row);
}

async function patchMealAllowanceRate(id, payload) {
  const existing = await prisma.mealAllowanceRate.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy mục mức tiền ăn",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const row = await prisma.mealAllowanceRate.update({
    where: { id },
    data: {
      ...(payload.doiTuong != null ? { doiTuong: payload.doiTuong.trim() } : {}),
      ...(payload.mucTienAn != null ? { mucTienAn: payload.mucTienAn } : {}),
      ...(payload.type != null ? { type: payload.type } : {}),
      ...(payload.sortOrder != null ? { sortOrder: payload.sortOrder } : {}),
    },
  });
  return mapRow(row);
}

async function deleteMealAllowanceRate(id) {
  const existing = await prisma.mealAllowanceRate.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy mục mức tiền ăn",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  await prisma.mealAllowanceRate.delete({ where: { id } });
}

export {
  createMealAllowanceRate,
  deleteMealAllowanceRate,
  listMealAllowanceRates,
  patchMealAllowanceRate,
};
