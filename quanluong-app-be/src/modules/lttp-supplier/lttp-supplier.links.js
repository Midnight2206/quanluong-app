import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const LTTP_SUPPLIER_TYPE_NAME = "lttp_supplier";

function uniqueSupplierIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError({
      message: "Chọn ít nhất một nhà cung cấp.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const out = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError({
        message: "Chọn ít nhất một nhà cung cấp.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

async function replaceUserLttpSupplierLinks(userId, supplierIds, db) {
  const ids = uniqueSupplierIds(supplierIds);
  const rows = await db.lttpSupplier.findMany({
    where: { id: { in: ids } },
    select: { id: true, unit: { select: { depth: true } } },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const missingOrDeep = ids.some((id) => byId.get(id)?.unit?.depth !== 0);
  if (missingOrDeep) {
    throw new AppError({
      message: "Nhà cung cấp không tồn tại hoặc không thuộc đơn vị cấp 1.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await db.userLttpSupplier.deleteMany({ where: { userId } });
  await db.userLttpSupplier.createMany({
    data: ids.map((lttpSupplierId) => ({ userId, lttpSupplierId })),
  });
}

async function clearUserLttpSupplierLinks(userId, db) {
  await db.userLttpSupplier.deleteMany({ where: { userId } });
}

export {
  LTTP_SUPPLIER_TYPE_NAME,
  clearUserLttpSupplierLinks,
  replaceUserLttpSupplierLinks,
  uniqueSupplierIds,
};
