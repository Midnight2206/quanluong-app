import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

function mapLink(row) {
  const supplier = row.lttpSupplier;
  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    level1UnitId: supplier.unit.id,
    level1UnitName: supplier.unit.name,
  };
}

async function listLttpSupplierLinks(userId, db) {
  const rows = await db.userLttpSupplier.findMany({
    where: { userId },
    orderBy: { lttpSupplierId: "asc" },
    include: {
      lttpSupplier: {
        select: { id: true, name: true, unit: { select: { id: true, name: true, depth: true } } },
      },
    },
  });

  return { links: rows.map(mapLink) };
}

async function listLttpSupplierCatalog(db) {
  const rows = await db.lttpSupplier.findMany({
    where: { unit: { depth: 0 } },
    orderBy: [{ unit: { name: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, unit: { select: { id: true, name: true, depth: true } } },
  });

  return {
    suppliers: rows.map((row) => ({
      id: row.id,
      name: row.name,
      level1UnitId: row.unit.id,
      level1UnitName: row.unit.name,
    })),
  };
}

async function readLttpSupplierOrders({ userId, supplierId, date, db, summarize }) {
  const link = await db.userLttpSupplier.findFirst({
    where: { userId, lttpSupplierId: Number(supplierId) },
    include: { lttpSupplier: { select: { id: true, unitId: true } } },
  });

  if (!link) {
    throw new AppError({
      message: "Không thấy nhà cung cấp của tài khoản này.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  const storageUnitId = link.lttpSupplier.unitId;

  return summarize(
    { unitId: storageUnitId, date, supplierFilter: Number(supplierId) },
    { mode: "all" },
    null,
    { storageUnitId, logicalUnitId: storageUnitId },
  );
}

export { listLttpSupplierCatalog, listLttpSupplierLinks, readLttpSupplierOrders };
