import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenRowStorage,
  assertKitchenWriteUnit,
} from "./kitchen-books-scope.helpers.js";
import { mapCatalog } from "./kitchen-books.mapper.js";

const CATALOG_INCLUDE = {
  lines: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      commodity: {
        select: { id: true, code: true, name: true, measureUnit: true, unitId: true },
      },
    },
  },
};

async function assertCommodityInStorage(commodityId, storageUnitId) {
  const commodity = await prisma.lttpCommodity.findFirst({
    where: { id: commodityId },
    select: { id: true, unitId: true },
  });
  if (!commodity || commodity.unitId !== storageUnitId) {
    throw new AppError({
      message: "Không tìm thấy mặt hàng LTTP",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return commodity;
}

function validateLinePayload(line, storageUnitId) {
  const calcMode = line.calcMode;
  if (calcMode === "per_person") {
    const amt = Number(line.perPersonAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new AppError({
        message: "Định mức g/ml mỗi người phải > 0",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (line.perPersonUnit !== "g" && line.perPersonUnit !== "ml") {
      throw new AppError({
        message: "Đơn vị định mức phải là g hoặc ml",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  } else if (calcMode === "per_unit_shared") {
    const ppu = Number(line.peoplePerUnit);
    if (!Number.isFinite(ppu) || ppu <= 0) {
      throw new AppError({
        message: "Số người / đơn vị phải > 0",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  } else {
    throw new AppError({
      message: "calcMode không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return assertCommodityInStorage(line.commodityId, storageUnitId);
}

async function validateLinesPayload(lines, storageUnitId) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError({
      message: "Cần ít nhất một dòng nguyên liệu LTTP",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  for (const line of lines) {
    await validateLinePayload(line, storageUnitId);
  }
}

function lineCreateData(line, index) {
  return {
    commodityId: line.commodityId,
    calcMode: line.calcMode,
    perPersonAmount: line.calcMode === "per_person" ? line.perPersonAmount : null,
    perPersonUnit: line.calcMode === "per_person" ? line.perPersonUnit : null,
    peoplePerUnit: line.calcMode === "per_unit_shared" ? line.peoplePerUnit : null,
    sortOrder: line.sortOrder ?? index,
  };
}

async function listCatalog({ unitId, q, limit = 50, offset = 0 }, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const where = { unitId: storageUnitId };
  const query = String(q ?? "").trim();
  if (query) {
    where.name = { contains: query };
  }
  const rows = await prisma.kitchenDishCatalog.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    skip: Math.max(Number(offset) || 0, 0),
    include: CATALOG_INCLUDE,
  });
  return rows.map(mapCatalog);
}

async function getCatalogById(id, unitId, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  const row = await prisma.kitchenDishCatalog.findFirst({
    where: { id },
    include: CATALOG_INCLUDE,
  });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy món trong danh mục",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertKitchenRowStorage(row.unitId, dataScope);
  return mapCatalog(row);
}

async function createCatalog(payload, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(payload.unitId, dataScope);
  assertKitchenWriteUnit(payload.unitId, scope, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const name = String(payload.name ?? "").trim();
  if (!name) {
    throw new AppError({
      message: "Tên món là bắt buộc",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await validateLinesPayload(payload.lines, storageUnitId);
  const row = await prisma.kitchenDishCatalog.create({
    data: {
      unitId: storageUnitId,
      name,
      note: payload.note != null ? String(payload.note).trim() || null : null,
      sortOrder: payload.sortOrder ?? 0,
      lines: {
        create: payload.lines.map((line, index) => lineCreateData(line, index)),
      },
    },
    include: CATALOG_INCLUDE,
  });
  return mapCatalog(row);
}

async function updateCatalog(id, payload, scope, effectiveUnitIds, dataScope) {
  const existing = await getCatalogById(id, payload.unitId, scope, effectiveUnitIds, dataScope);
  const storageUnitId = dataScope.storageUnitId;
  const name = payload.name != null ? String(payload.name).trim() : existing.name;
  if (!name) {
    throw new AppError({
      message: "Tên món là bắt buộc",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (payload.lines) {
    await validateLinesPayload(payload.lines, storageUnitId);
  }
  const row = await prisma.$transaction(async (tx) => {
    if (payload.lines) {
      await tx.kitchenDishCatalogLine.deleteMany({ where: { catalogId: id } });
    }
    return tx.kitchenDishCatalog.update({
      where: { id },
      data: {
        name,
        note: payload.note !== undefined ? String(payload.note ?? "").trim() || null : undefined,
        sortOrder: payload.sortOrder,
        ...(payload.lines
          ? {
              lines: {
                create: payload.lines.map((line, index) => lineCreateData(line, index)),
              },
            }
          : {}),
      },
      include: CATALOG_INCLUDE,
    });
  });
  return mapCatalog(row);
}

async function deleteCatalog(id, unitId, scope, effectiveUnitIds, dataScope) {
  await getCatalogById(id, unitId, scope, effectiveUnitIds, dataScope);
  await prisma.kitchenDishCatalog.delete({ where: { id } });
  return { id };
}

export {
  listCatalog,
  getCatalogById,
  createCatalog,
  updateCatalog,
  deleteCatalog,
  validateLinePayload,
  lineCreateData,
  CATALOG_INCLUDE,
};
