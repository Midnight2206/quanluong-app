import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { buildSupplierLedger } from "./lttp-supplier.ledger.js";

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

function ymd(value) {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

async function readLttpSupplierLedger({ userId, supplierId, from, to, db }) {
  const link = await db.userLttpSupplier.findFirst({
    where: { userId, lttpSupplierId: Number(supplierId) },
    include: { lttpSupplier: { select: { id: true, unitId: true, name: true, unit: { select: { name: true } } } } },
  });

  if (!link) {
    throw new AppError({
      message: "Không thấy nhà cung cấp của tài khoản này.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  const storageUnitId = link.lttpSupplier.unitId;
  const slips = await db.lttpIssueSlip.findMany({
    where: {
      unitId: storageUnitId,
      issueDate: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) },
      lines: { some: { lttpSupplierId: Number(supplierId) } },
    },
    orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    include: {
      recipientUnit: { select: { id: true, name: true } },
      lines: {
        where: { lttpSupplierId: Number(supplierId) },
        include: { commodity: { select: { id: true, name: true, measureUnit: true } } },
      },
    },
  });

  const priceByDate = {};
  const seen = new Set();
  for (const slip of slips) {
    const date = ymd(slip.issueDate);
    if (seen.has(date)) continue;
    seen.add(date);
    const table = await db.lttpPartnerPriceTable.findFirst({
      where: { unitId: storageUnitId, effectiveDate: { lte: new Date(`${date}T00:00:00.000Z`) } },
      orderBy: { effectiveDate: "desc" },
      include: { rows: { select: { commodityId: true, partnerUnitPrice: true } } },
    });
    const prices = {};
    for (const row of table?.rows ?? []) {
      prices[row.commodityId] = row.partnerUnitPrice == null ? null : Number(row.partnerUnitPrice);
    }
    priceByDate[date] = prices;
  }

  const ledger = buildSupplierLedger(
    slips.map((slip) => ({
      date: ymd(slip.issueDate),
      recipientUnitId: slip.recipientUnitId,
      recipientUnitName: slip.recipientUnit?.name ?? null,
      lines: slip.lines.map((line) => ({
        commodityId: line.commodityId,
        name: line.commodity?.name,
        measureUnit: line.commodity?.measureUnit,
        quantity: Number(line.quantity),
      })),
    })),
    priceByDate,
  );

  return {
    from,
    to,
    supplierName: link.lttpSupplier.name,
    level1UnitName: link.lttpSupplier.unit?.name ?? "",
    ...ledger,
  };
}

export { listLttpSupplierCatalog, listLttpSupplierLinks, readLttpSupplierLedger, readLttpSupplierOrders };
