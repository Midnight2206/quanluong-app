import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { aggregateDailyInvoiceLines, INVOICE_VAT_NOTE } from "./lttp-supplier.invoice.js";
import { buildSupplierLedger } from "./lttp-supplier.ledger.js";

const SUPPLIER_PROFILE_SELECT = {
  id: true,
  name: true,
  representativeName: true,
  address: true,
  businessLicenseNo: true,
  taxCode: true,
  phone: true,
  email: true,
  unitId: true,
  unit: { select: { id: true, name: true } },
};

function cleanOptionalString(v, maxLen) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function mapSupplierProfile(row) {
  return {
    supplierId: row.id,
    name: row.name,
    representativeName: row.representativeName,
    address: row.address ?? null,
    businessLicenseNo: row.businessLicenseNo ?? null,
    taxCode: row.taxCode ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    level1UnitId: row.unit?.id ?? row.unitId,
    level1UnitName: row.unit?.name ?? "",
  };
}

function mapLink(row) {
  const supplier = row.lttpSupplier;
  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    level1UnitId: supplier.unit.id,
    level1UnitName: supplier.unit.name,
  };
}

async function requireLinkedSupplier(userId, supplierId, db) {
  const link = await db.userLttpSupplier.findFirst({
    where: { userId, lttpSupplierId: Number(supplierId) },
    include: { lttpSupplier: { select: SUPPLIER_PROFILE_SELECT } },
  });
  if (!link) {
    throw new AppError({
      message: "Không thấy nhà cung cấp của tài khoản này.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return link;
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

async function getLttpSupplierMe({ userId, supplierId, db }) {
  const link = await requireLinkedSupplier(userId, supplierId, db);
  return mapSupplierProfile(link.lttpSupplier);
}

async function patchLttpSupplierMe({ userId, supplierId, payload, db }) {
  await requireLinkedSupplier(userId, supplierId, db);
  const data = {};
  if (payload.name !== undefined) {
    const n = String(payload.name ?? "").trim();
    if (!n) {
      throw new AppError({
        message: "Tên nhà cung cấp không được để trống",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    data.name = n;
  }
  if (payload.representativeName !== undefined) {
    const n = String(payload.representativeName ?? "").trim();
    if (!n) {
      throw new AppError({
        message: "Tên người đại diện không được để trống",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    data.representativeName = n;
  }
  if (payload.address !== undefined) data.address = cleanOptionalString(payload.address, 500);
  if (payload.businessLicenseNo !== undefined) {
    data.businessLicenseNo = cleanOptionalString(payload.businessLicenseNo, 64);
  }
  if (payload.taxCode !== undefined) data.taxCode = cleanOptionalString(payload.taxCode, 32);
  if (payload.phone !== undefined) data.phone = cleanOptionalString(payload.phone, 32);
  if (payload.email !== undefined) data.email = cleanOptionalString(payload.email, 255);

  if (Object.keys(data).length) {
    await db.lttpSupplier.update({ where: { id: Number(supplierId) }, data });
  }
  return getLttpSupplierMe({ userId, supplierId, db });
}

async function readLttpSupplierDailyInvoice({ userId, supplierId, date, db }) {
  const ledger = await readLttpSupplierLedger({
    userId,
    supplierId,
    from: date,
    to: date,
    db,
  });
  const day = (ledger.days ?? []).find((row) => row.date === date) ?? { lines: [], total: 0 };
  const { lines, grandTotal } = aggregateDailyInvoiceLines(day.lines);
  const link = await requireLinkedSupplier(userId, supplierId, db);
  const seller = mapSupplierProfile(link.lttpSupplier);
  return {
    date,
    note: INVOICE_VAT_NOTE,
    seller,
    buyer: {
      unitId: seller.level1UnitId,
      name: seller.level1UnitName,
    },
    lines,
    grandTotal,
  };
}

function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/** Tổng nợ / đã trả / còn lại + từng lần thanh toán (cùng nguồn Midnight partner debt). */
async function readLttpSupplierDebt({ userId, supplierId, db }) {
  const link = await requireLinkedSupplier(userId, supplierId, db);
  const unitId = link.lttpSupplier.unitId;
  const sid = Number(supplierId);
  const [debt, paid, payments] = await Promise.all([
    db.lttpPartnerDebt.findUnique({
      where: { unitId_lttpSupplierId: { unitId, lttpSupplierId: sid } },
    }),
    db.lttpPartnerPaymentTotal.findUnique({
      where: { unitId_lttpSupplierId: { unitId, lttpSupplierId: sid } },
    }),
    db.lttpPartnerPayment.findMany({
      where: { unitId, lttpSupplierId: sid },
      orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
    }),
  ]);

  const totalDebtAmount = debt?.totalDebtAmount != null ? Number(debt.totalDebtAmount) : 0;
  const totalPaidAmount = paid?.totalPaidAmount != null ? Number(paid.totalPaidAmount) : 0;
  return {
    supplierId: sid,
    supplierName: link.lttpSupplier.name,
    level1UnitName: link.lttpSupplier.unit?.name ?? "",
    totalDebtAmount,
    totalPaidAmount,
    remainingAmount: roundMoney2(totalDebtAmount - totalPaidAmount),
    lastRecalculatedAt: debt?.lastRecalculatedAt ?? null,
    payments: payments.map((row) => ({
      id: row.id,
      paymentDate: row.paymentDate.toISOString().slice(0, 10),
      amount: Number(row.amount),
      note: row.note,
      createdAt: row.createdAt,
    })),
  };
}

export {
  getLttpSupplierMe,
  listLttpSupplierCatalog,
  listLttpSupplierLinks,
  patchLttpSupplierMe,
  readLttpSupplierDailyInvoice,
  readLttpSupplierDebt,
  readLttpSupplierLedger,
  readLttpSupplierOrders,
};
