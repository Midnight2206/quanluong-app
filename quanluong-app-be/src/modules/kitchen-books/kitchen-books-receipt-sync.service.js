/**
 * Đồng bộ dòng Trên BĐ (on_guarantee) của phiếu nhập kho từ phiếu xuất LTTP.
 * Tách file để lttp.service có thể gọi mà không vòng import với receipt-slip.service.
 *
 * Phiếu nhập kho gắn theo đơn vị nhận (logical / recipient), không theo kho LTTP chung
 * (nhiều đơn vị con có thể share storageUnitId qua grant).
 */
import { prisma } from "../../infra/database/prisma/prisma.client.js";

const PRICE_KIND = {
  MARKET: "market",
  TGSX: "tgsx",
};

const LINE_SOURCE = {
  ON_GUARANTEE: "on_guarantee",
  UNIT_SELF: "unit_self",
};

function parseDateOnly(ymd) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    throw new Error(`Ngày không hợp lệ: ${ymd}`);
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function bookMmyyFromYmd(ymd) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return "----";
  }
  const yy = String(Number(m[1]) % 100).padStart(2, "0");
  return `${m[2]}${yy}`;
}

function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return 0;
  }
  return Math.round(x * 100) / 100;
}

function normalizePriceKind(value) {
  return String(value ?? "").trim().toLowerCase() === PRICE_KIND.TGSX
    ? PRICE_KIND.TGSX
    : PRICE_KIND.MARKET;
}

function issueLineApplied(line) {
  const kind = normalizePriceKind(line.priceKind);
  const market = Number(line.unitPrice);
  const tgsx = line.tgsxPrice != null ? Number(line.tgsxPrice) : null;
  const applied =
    kind === PRICE_KIND.TGSX && tgsx != null && Number.isFinite(tgsx) ? tgsx : market;
  return {
    priceKind: kind,
    appliedPrice: applied,
    unitPrice: Number.isFinite(market) ? market : applied,
    tgsxPrice: tgsx != null && Number.isFinite(tgsx) ? tgsx : null,
  };
}

/**
 * Gom dòng phiếu xuất LTTP theo recipientUnitId + ngày.
 * @returns {Promise<{ buckets: Map<string, object>, issueSlipCount: number }>}
 */
async function aggregateOnGuaranteeFromIssueSlips(recipientUnitId, dateYmd, db = prisma) {
  const issueD = parseDateOnly(dateYmd);
  const slips = await db.lttpIssueSlip.findMany({
    where: {
      recipientUnitId: Number(recipientUnitId),
      issueDate: issueD,
    },
    include: {
      lines: {
        include: { commodity: { select: { id: true, code: true, name: true } } },
      },
    },
  });

  /** @type {Map<string, { commodityId: number, commodityCode: string, priceKind: string, appliedPrice: number, unitPrice: number, tgsxPrice: number|null, quantity: number }>} */
  const buckets = new Map();

  for (const slip of slips) {
    for (const line of slip.lines ?? []) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        continue;
      }
      const snap = issueLineApplied(line);
      if (!Number.isFinite(snap.appliedPrice)) {
        continue;
      }
      const key = `${line.commodityId}:${snap.priceKind}:${roundMoney2(snap.appliedPrice)}`;
      const prev = buckets.get(key);
      if (prev) {
        prev.quantity += qty;
      } else {
        buckets.set(key, {
          commodityId: line.commodityId,
          commodityCode: line.commodity?.code ?? "",
          priceKind: snap.priceKind,
          appliedPrice: roundMoney2(snap.appliedPrice),
          unitPrice: roundMoney2(snap.unitPrice),
          tgsxPrice:
            snap.tgsxPrice != null ? roundMoney2(snap.tgsxPrice) : null,
          quantity: qty,
        });
      }
    }
  }

  return { buckets, issueSlipCount: slips.length, issueD };
}

async function ensureKitchenReceiptSlipHeader(
  { ownerUnitId, receiptD, dateYmd, actorUserId },
  db,
) {
  const existing = await db.kitchenReceiptSlip.findUnique({
    where: {
      unitId_receiptDate: { unitId: ownerUnitId, receiptDate: receiptD },
    },
  });
  if (existing) {
    return existing;
  }

  const bookMmyy = bookMmyyFromYmd(dateYmd);
  await db.kitchenReceiptSlipSerial.upsert({
    where: { unitId_bookMmyy: { unitId: ownerUnitId, bookMmyy } },
    create: { unitId: ownerUnitId, bookMmyy, lastSlipNo: 0 },
    update: {},
  });
  const ser = await db.kitchenReceiptSlipSerial.update({
    where: { unitId_bookMmyy: { unitId: ownerUnitId, bookMmyy } },
    data: { lastSlipNo: { increment: 1 } },
  });

  return db.kitchenReceiptSlip.create({
    data: {
      unitId: ownerUnitId,
      receiptDate: receiptD,
      note: null,
      createdById: actorUserId,
      bookMmyy,
      slipNo: ser.lastSlipNo,
    },
  });
}

/**
 * Tính lại toàn bộ dòng on_guarantee cho phiếu nhập của đơn vị nhận trong ngày.
 * @param {{ recipientUnitId: number, dateYmd: string, actorUserId: number }} args
 */
async function syncKitchenReceiptOnGuaranteeFromIssueSlips({
  recipientUnitId,
  dateYmd,
  actorUserId,
}) {
  const rid = Number(recipientUnitId);
  if (!Number.isInteger(rid) || rid <= 0 || !dateYmd || !actorUserId) {
    return { ok: false, skipped: true };
  }

  const { buckets, issueD } = await aggregateOnGuaranteeFromIssueSlips(rid, dateYmd);

  const result = await prisma.$transaction(async (tx) => {
    const slip = await ensureKitchenReceiptSlipHeader(
      {
        ownerUnitId: rid,
        receiptD: issueD,
        dateYmd,
        actorUserId: Number(actorUserId),
      },
      tx,
    );

    await tx.kitchenReceiptSlipLine.deleteMany({
      where: { slipId: slip.id, lineSource: LINE_SOURCE.ON_GUARANTEE },
    });

    if (buckets.size) {
      await tx.kitchenReceiptSlipLine.createMany({
        data: [...buckets.values()].map((b) => {
          const amount = roundMoney2(b.quantity * b.appliedPrice);
          return {
            slipId: slip.id,
            commodityId: b.commodityId,
            quantity: String(b.quantity),
            unitPrice: String(b.unitPrice),
            tgsxPrice: b.tgsxPrice != null ? String(b.tgsxPrice) : null,
            priceKind: b.priceKind,
            lineSource: LINE_SOURCE.ON_GUARANTEE,
            amount: String(amount),
            lineNote: null,
          };
        }),
      });
    }

    return { slipId: slip.id, ownerUnitId: rid, onGuaranteeCount: buckets.size };
  });

  return { ok: true, ...result };
}

export {
  LINE_SOURCE,
  PRICE_KIND,
  aggregateOnGuaranteeFromIssueSlips,
  syncKitchenReceiptOnGuaranteeFromIssueSlips,
  parseDateOnly,
  bookMmyyFromYmd,
  roundMoney2,
  normalizePriceKind,
};
