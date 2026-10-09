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
  await writeUserLttpSupplierLinks(userId, ids, db);
}

async function writeUserLttpSupplierLinks(userId, ids, db) {
  const run = async (client) => {
    await client.userLttpSupplier.deleteMany({ where: { userId } });
    await client.userLttpSupplier.createMany({
      data: ids.map((lttpSupplierId) => ({ userId, lttpSupplierId })),
    });
  };
  // A transaction client still has $transaction. Another one would leave the
  // user row. $connect exists only on the root client.
  if (typeof db.$connect === "function" && typeof db.$transaction === "function") {
    await db.$transaction(run);
    return;
  }
  await run(db);
}

async function clearUserLttpSupplierLinks(userId, db) {
  await db.userLttpSupplier.deleteMany({ where: { userId } });
}

function blankUnitFieldsForSupplier(typeName, fields) {
  if (typeName !== LTTP_SUPPLIER_TYPE_NAME) {
    return fields;
  }
  return { ...fields, unitId: null, assignedUnitId: null, jobTitleId: null };
}

async function syncLttpSupplierAssignment(
  userId,
  { nextTypeName, mode, supplierIds },
  db,
) {
  if (nextTypeName !== LTTP_SUPPLIER_TYPE_NAME) {
    await clearUserLttpSupplierLinks(userId, db);
    return;
  }
  if (supplierIds === undefined) {
    if (mode === "patch") {
      return;
    }
    throw new AppError({
      message: "Chọn ít nhất một nhà cung cấp.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await replaceUserLttpSupplierLinks(userId, supplierIds, db);
}

export {
  blankUnitFieldsForSupplier,
  LTTP_SUPPLIER_TYPE_NAME,
  clearUserLttpSupplierLinks,
  replaceUserLttpSupplierLinks,
  syncLttpSupplierAssignment,
  uniqueSupplierIds,
};
