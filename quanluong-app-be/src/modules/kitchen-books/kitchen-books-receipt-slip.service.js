import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import {
  getEffectivePrices,
  listCommodities,
  resolveIssueSlipLine,
} from "../lttp/lttp.service.js";
import {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenRowLogical,
  assertKitchenWriteUnit,
  parseDateOnly,
} from "./kitchen-books-scope.helpers.js";
import {
  LINE_SOURCE,
  PRICE_KIND as LTTP_ISSUE_SLIP_PRICE_KIND,
  aggregateOnGuaranteeFromIssueSlips,
  bookMmyyFromYmd,
  normalizePriceKind,
  roundMoney2,
  syncKitchenReceiptOnGuaranteeFromIssueSlips,
} from "./kitchen-books-receipt-sync.service.js";

const commodityInclude = {
  group: true,
  lttpCommodityDefaultSupplier: { include: { lttpSupplier: true } },
};

const receiptSlipInclude = {
  lines: {
    include: { commodity: { include: commodityInclude } },
    orderBy: [{ lineSource: "asc" }, { id: "asc" }],
  },
  createdBy: {
    select: { id: true, username: true, profile: { select: { fullName: true } } },
  },
};

function issueSlipLineDedupeKey(commodityId, priceKind) {
  const cid = Number(commodityId);
  if (!Number.isInteger(cid) || cid <= 0) {
    return null;
  }
  return `${cid}:${normalizePriceKind(priceKind)}`;
}

function resolveIssueSlipLinePriceSnapshot(hit, priceKind, commodityIdForMessage) {
  const kind = normalizePriceKind(priceKind);
  const marketPrice =
    hit?.unitPrice != null && Number.isFinite(Number(hit.unitPrice)) ? Number(hit.unitPrice) : null;
  const tgsxPrice =
    hit?.tgsxPrice != null && Number.isFinite(Number(hit.tgsxPrice)) ? Number(hit.tgsxPrice) : null;
  const cid = commodityIdForMessage ?? hit?.commodity?.id ?? "?";

  if (kind === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX) {
    if (tgsxPrice == null) {
      return {
        ok: false,
        message: `Chưa có giá TGSX tại ngày cho mặt hàng (id: ${cid})`,
      };
    }
    return {
      ok: true,
      priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.TGSX,
      unitPrice: marketPrice ?? tgsxPrice,
      tgsxPrice,
      appliedPrice: tgsxPrice,
    };
  }

  if (marketPrice == null) {
    return {
      ok: false,
      message: `Chưa có đơn giá tại ngày cho mặt hàng (id: ${cid})`,
    };
  }
  return {
    ok: true,
    priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET,
    unitPrice: marketPrice,
    tgsxPrice,
    appliedPrice: marketPrice,
  };
}

function mapReceiptCommodity(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    measureUnit: row.measureUnit,
    groupId: row.groupId,
    group: row.group ? { id: row.group.id, code: row.group.code, name: row.group.name } : null,
  };
}

function mapReceiptSlipLine(r) {
  const kind = normalizePriceKind(r.priceKind);
  return {
    id: r.id,
    commodityId: r.commodityId,
    commodity: mapReceiptCommodity(r.commodity),
    quantity: Number(r.quantity),
    priceKind: kind,
    lineSource: r.lineSource === LINE_SOURCE.ON_GUARANTEE
      ? LINE_SOURCE.ON_GUARANTEE
      : LINE_SOURCE.UNIT_SELF,
    unitPrice: Number(r.unitPrice),
    tgsxPrice: r.tgsxPrice != null ? Number(r.tgsxPrice) : null,
    amount: Number(r.amount),
    lineNote: r.lineNote,
  };
}

function mapReceiptSlip(slip) {
  if (!slip) {
    return null;
  }
  return {
    id: slip.id,
    unitId: slip.unitId,
    receiptDate: slip.receiptDate.toISOString().slice(0, 10),
    note: slip.note,
    bookMmyy: slip.bookMmyy,
    slipNo: slip.slipNo,
    createdAt: slip.createdAt.toISOString(),
    updatedAt: slip.updatedAt.toISOString(),
    createdBy: slip.createdBy
      ? {
          id: slip.createdBy.id,
          username: slip.createdBy.username,
          fullName: slip.createdBy.profile?.fullName ?? null,
        }
      : null,
    lines: (slip.lines ?? []).map(mapReceiptSlipLine),
  };
}

async function buildUnitSelfLineDataFromPayload(lines, eff, forcedPriceKind) {
  const seen = new Set();
  const commodityCounts = new Map();
  const lineData = [];
  const priceByCid = new Map(eff.items.map((i) => [i.commodity.id, i]));
  const forceKind = forcedPriceKind != null ? normalizePriceKind(forcedPriceKind) : null;

  for (const raw of lines) {
    const cid = Number(raw.commodityId);
    const qty = Number(raw.quantity);
    if (!Number.isInteger(cid) || cid <= 0) {
      throw new AppError({
        message: "commodityId không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const kind = forceKind ?? normalizePriceKind(raw.priceKind);
    const commodityN = commodityCounts.get(cid) ?? 0;
    if (commodityN >= 1) {
      throw new AppError({
        message: "Trùng mặt hàng trong cùng loại giá (Mua TT hoặc TGSX)",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    commodityCounts.set(cid, commodityN + 1);
    const dedupeKey = issueSlipLineDedupeKey(cid, kind);
    if (dedupeKey && seen.has(dedupeKey)) {
      throw new AppError({
        message: "Trùng mặt hàng và loại giá (Mua TT/TGSX) trong phiếu",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (dedupeKey) {
      seen.add(dedupeKey);
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError({
        message: "Số lượng phải lớn hơn 0",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const hit = priceByCid.get(cid);
    const priceSnap = resolveIssueSlipLinePriceSnapshot(hit, kind, cid);
    if (!priceSnap.ok) {
      throw new AppError({
        message: priceSnap.message,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const amount = roundMoney2(qty * priceSnap.appliedPrice);
    const lineNoteTrim =
      raw.lineNote != null && String(raw.lineNote).trim() !== ""
        ? String(raw.lineNote).trim().slice(0, 500)
        : null;
    lineData.push({
      commodityId: cid,
      quantity: String(qty),
      unitPrice: String(priceSnap.unitPrice),
      tgsxPrice: priceSnap.tgsxPrice != null ? String(priceSnap.tgsxPrice) : null,
      priceKind: priceSnap.priceKind,
      lineSource: LINE_SOURCE.UNIT_SELF,
      amount: String(amount),
      lineNote: lineNoteTrim,
    });
  }

  return lineData;
}

async function ensureDaySlipHeader(ownerUnitId, receiptDate, userId, note) {
  const receiptD = parseDateOnly(receiptDate);
  const bookMmyy = bookMmyyFromYmd(receiptDate);
  const existing = await prisma.kitchenReceiptSlip.findUnique({
    where: {
      unitId_receiptDate: { unitId: ownerUnitId, receiptDate: receiptD },
    },
  });
  if (existing) {
    if (note !== undefined) {
      return prisma.kitchenReceiptSlip.update({
        where: { id: existing.id },
        data: { note: note?.trim() || null },
      });
    }
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    await tx.kitchenReceiptSlipSerial.upsert({
      where: { unitId_bookMmyy: { unitId: ownerUnitId, bookMmyy } },
      create: { unitId: ownerUnitId, bookMmyy, lastSlipNo: 0 },
      update: {},
    });
    const ser = await tx.kitchenReceiptSlipSerial.update({
      where: { unitId_bookMmyy: { unitId: ownerUnitId, bookMmyy } },
      data: { lastSlipNo: { increment: 1 } },
    });
    return tx.kitchenReceiptSlip.create({
      data: {
        unitId: ownerUnitId,
        receiptDate: receiptD,
        note: note?.trim() || null,
        createdById: userId,
        bookMmyy,
        slipNo: ser.lastSlipNo,
      },
    });
  });
}

async function getNextKitchenReceiptSlipSerial(
  { unitId, date: dateStr },
  scope,
  effectiveUnitIds,
  dataScope,
) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  const ownerUnitId = dataScope.logicalUnitId;
  const bookMmyy = bookMmyyFromYmd(dateStr);
  const row = await prisma.kitchenReceiptSlipSerial.findUnique({
    where: { unitId_bookMmyy: { unitId: ownerUnitId, bookMmyy } },
  });
  const last = row?.lastSlipNo ?? 0;
  return { unitId: ownerUnitId, bookMmyy, lastSlipNo: last, nextSlipNo: last + 1 };
}

async function listKitchenReceiptSlips(query, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(query.unitId, dataScope);
  assertKitchenWriteUnit(query.unitId, scope, effectiveUnitIds);
  const ownerUnitId = dataScope.logicalUnitId;
  const where = { unitId: ownerUnitId };
  if (query.date) {
    where.receiptDate = parseDateOnly(query.date);
  }
  const rows = await prisma.kitchenReceiptSlip.findMany({
    where,
    include: receiptSlipInclude,
    orderBy: [{ receiptDate: "desc" }, { slipNo: "desc" }],
    take: query.limit ?? 50,
  });
  return rows.map(mapReceiptSlip);
}

async function getKitchenReceiptSlipByDay(
  { unitId, date },
  scope,
  effectiveUnitIds,
  dataScope,
) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  const slip = await prisma.kitchenReceiptSlip.findUnique({
    where: {
      unitId_receiptDate: {
        unitId: dataScope.logicalUnitId,
        receiptDate: parseDateOnly(date),
      },
    },
    include: receiptSlipInclude,
  });
  return mapReceiptSlip(slip);
}

async function getKitchenReceiptSlipById(id, scope, effectiveUnitIds, dataScope) {
  const slip = await prisma.kitchenReceiptSlip.findFirst({
    where: { id: Number(id) },
    include: receiptSlipInclude,
  });
  if (!slip) {
    throw new AppError({
      message: "Không tìm thấy phiếu nhập kho",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertKitchenRowLogical(slip.unitId, dataScope);
  assertKitchenWriteUnit(dataScope.logicalUnitId, scope, effectiveUnitIds);
  return mapReceiptSlip(slip);
}

/**
 * Upsert dòng unit_self theo priceKind cho đúng 1 phiếu/ngày.
 * Không đụng dòng on_guarantee.
 */
async function upsertKitchenReceiptUnitSelfLines(
  payload,
  userId,
  scope,
  effectiveUnitIds,
  dataScope,
) {
  const { unitId, receiptDate, note, lines, priceKind } = payload;
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  if (!Array.isArray(lines)) {
    throw new AppError({
      message: "lines phải là mảng",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const kind = normalizePriceKind(priceKind);
  const ownerUnitId = dataScope.logicalUnitId;

  const eff = await getEffectivePrices(
    { unitId, date: receiptDate },
    scope,
    effectiveUnitIds,
    dataScope,
  );
  const lineData = await buildUnitSelfLineDataFromPayload(lines, eff, kind);

  const slip = await prisma.$transaction(async (tx) => {
    let header = await tx.kitchenReceiptSlip.findUnique({
      where: {
        unitId_receiptDate: {
          unitId: ownerUnitId,
          receiptDate: parseDateOnly(receiptDate),
        },
      },
    });
    if (!header) {
      const bookMmyy = bookMmyyFromYmd(receiptDate);
      await tx.kitchenReceiptSlipSerial.upsert({
        where: { unitId_bookMmyy: { unitId: ownerUnitId, bookMmyy } },
        create: { unitId: ownerUnitId, bookMmyy, lastSlipNo: 0 },
        update: {},
      });
      const ser = await tx.kitchenReceiptSlipSerial.update({
        where: { unitId_bookMmyy: { unitId: ownerUnitId, bookMmyy } },
        data: { lastSlipNo: { increment: 1 } },
      });
      header = await tx.kitchenReceiptSlip.create({
        data: {
          unitId: ownerUnitId,
          receiptDate: parseDateOnly(receiptDate),
          note: note?.trim() || null,
          createdById: userId,
          bookMmyy,
          slipNo: ser.lastSlipNo,
        },
      });
    } else if (note !== undefined) {
      header = await tx.kitchenReceiptSlip.update({
        where: { id: header.id },
        data: { note: note?.trim() || null },
      });
    }

    await tx.kitchenReceiptSlipLine.deleteMany({
      where: {
        slipId: header.id,
        lineSource: LINE_SOURCE.UNIT_SELF,
        priceKind: kind,
      },
    });
    if (lineData.length) {
      await tx.kitchenReceiptSlipLine.createMany({
        data: lineData.map((d) => ({ slipId: header.id, ...d })),
      });
    }

    return tx.kitchenReceiptSlip.findUnique({
      where: { id: header.id },
      include: receiptSlipInclude,
    });
  });

  return mapReceiptSlip(slip);
}

/** POST: upsert unit_self (priceKind từ body hoặc suy từ dòng đầu). */
async function createKitchenReceiptSlip(payload, userId, scope, effectiveUnitIds, dataScope) {
  const priceKind =
    payload.priceKind ??
    (Array.isArray(payload.lines) && payload.lines[0]?.priceKind) ??
    LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
  return upsertKitchenReceiptUnitSelfLines(
    { ...payload, priceKind },
    userId,
    scope,
    effectiveUnitIds,
    dataScope,
  );
}

async function updateKitchenReceiptSlip(id, payload, scope, effectiveUnitIds, dataScope) {
  const existing = await prisma.kitchenReceiptSlip.findFirst({
    where: { id: Number(id) },
  });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy phiếu nhập kho",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertKitchenRowLogical(existing.unitId, dataScope);
  assertKitchenWriteUnit(dataScope.logicalUnitId, scope, effectiveUnitIds);

  const receiptDateYmd = existing.receiptDate.toISOString().slice(0, 10);
  const priceKind =
    payload.priceKind ??
    (Array.isArray(payload.lines) && payload.lines[0]?.priceKind) ??
    LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;

  return upsertKitchenReceiptUnitSelfLines(
    {
      unitId: dataScope.logicalUnitId,
      receiptDate: receiptDateYmd,
      note: payload.note,
      lines: payload.lines ?? [],
      priceKind,
    },
    existing.createdById,
    scope,
    effectiveUnitIds,
    dataScope,
  );
}

async function deleteKitchenReceiptSlip(id, scope, effectiveUnitIds, dataScope) {
  const existing = await prisma.kitchenReceiptSlip.findFirst({
    where: { id: Number(id) },
  });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy phiếu nhập kho",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertKitchenRowLogical(existing.unitId, dataScope);
  assertKitchenWriteUnit(dataScope.logicalUnitId, scope, effectiveUnitIds);
  await prisma.kitchenReceiptSlip.delete({ where: { id: existing.id } });
  return { id: existing.id };
}

function formatAggregatedQuantity(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return "0";
  }
  const s = x.toFixed(4);
  const t = s.replace(/\.?0+$/, "");
  return t === "" ? "0" : t;
}

async function getKitchenReceiptGuaranteeFromIssueSlips(
  { unitId, date },
  scope,
  effectiveUnitIds,
  dataScope,
) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  const recipientUnitId = Number(unitId);
  const { buckets, issueSlipCount, issueD } = await aggregateOnGuaranteeFromIssueSlips(
    recipientUnitId,
    date,
  );

  const items = [...buckets.values()].map((b) => ({
    commodityId: b.commodityId,
    commodityCode: b.commodityCode,
    priceKind: b.priceKind,
    appliedPrice: b.appliedPrice,
    quantity: formatAggregatedQuantity(b.quantity),
  }));

  const byKey = Object.fromEntries(
    [...buckets.entries()].map(([k, v]) => [k, Number(v.quantity)]),
  );

  return {
    recipientUnitId,
    date: issueD.toISOString().slice(0, 10),
    issueSlipCount,
    items,
    byKey,
  };
}

export {
  createKitchenReceiptSlip,
  deleteKitchenReceiptSlip,
  getKitchenReceiptGuaranteeFromIssueSlips,
  getKitchenReceiptSlipByDay,
  getKitchenReceiptSlipById,
  getNextKitchenReceiptSlipSerial,
  listKitchenReceiptSlips,
  listCommodities,
  resolveIssueSlipLine,
  syncKitchenReceiptOnGuaranteeFromIssueSlips,
  updateKitchenReceiptSlip,
  upsertKitchenReceiptUnitSelfLines,
  ensureDaySlipHeader,
};
