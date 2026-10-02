import { prisma as defaultPrisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { markChungTuDocumentsStaleForStorageUnit } from "../chung-tu-quyet-toan/chung-tu-document.service.js";

function toUtcDateOnly(input) {
  if (input instanceof Date) {
    const ymd = input.toISOString().slice(0, 10);
    return toUtcDateOnly(ymd);
  }
  const m = String(input ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    throw new AppError({
      message: "Ngày phải dạng YYYY-MM-DD",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function displayNameFromUserRow(user) {
  const fullName = user?.profile?.fullName != null ? String(user.profile.fullName).trim() : "";
  if (fullName) return fullName;
  return String(user?.username ?? "").trim();
}

const buyerInclude = { include: { profile: { select: { fullName: true } } } };

/** User thuộc đúng đơn vị kho, không lấy nhánh con. */
export async function assertWarehouseBuyerUser(userId, storageUnitId, db = defaultPrisma) {
  const id = Number(userId);
  const unitId = Number(storageUnitId);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(unitId) || unitId <= 0) {
    throw new AppError({
      message: "Người mua không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const user = await db.user.findFirst({
    where: { id, unitId, deletedAt: null, isActive: true },
    ...buyerInclude,
  });
  if (!user) {
    throw new AppError({
      message: "Người mua phải là user của chính kho này.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return user;
}

async function findTerm(db, unitId, issueDate) {
  return db.lttpWarehouseBuyerTerm.findFirst({
    where: { unitId, effectiveDate: { lte: toUtcDateOnly(issueDate) } },
    orderBy: { effectiveDate: "desc" },
    include: { buyerUser: buyerInclude },
  });
}

export async function resolveWarehouseBuyerForIssueDate(storageUnitId, issueDate, db = defaultPrisma) {
  const unitId = Number(storageUnitId);
  if (!Number.isInteger(unitId) || unitId <= 0 || issueDate == null || issueDate === "") {
    return { buyerUserId: null, buyerDisplayName: null, effectiveDate: null };
  }
  const term = await findTerm(db, unitId, issueDate);
  if (!term?.buyerUser) {
    return { buyerUserId: null, buyerDisplayName: null, effectiveDate: null };
  }
  return {
    buyerUserId: term.buyerUserId,
    buyerDisplayName: displayNameFromUserRow(term.buyerUser) || null,
    effectiveDate: toUtcDateOnly(term.effectiveDate).toISOString().slice(0, 10),
  };
}

export async function getEffectiveWarehouseBuyer(storageUnitId, date, db = defaultPrisma) {
  const resolved = await resolveWarehouseBuyerForIssueDate(storageUnitId, date, db);
  return { unitId: Number(storageUnitId), ...resolved };
}

async function syncLatestDefaultBuyer(db, unitId) {
  const latest = await db.lttpWarehouseBuyerTerm.findFirst({
    where: { unitId },
    orderBy: { effectiveDate: "desc" },
    select: { buyerUserId: true },
  });
  if (!latest) return;
  await db.lttpUnitIssueFormDefaults.upsert({
    where: { unitId },
    create: { unitId, defaultBuyerUserId: latest.buyerUserId },
    update: { defaultBuyerUserId: latest.buyerUserId },
  });
}

export async function setWarehouseBuyerTerm(
  { storageUnitId, userId, effectiveDate, createdById },
  db = defaultPrisma,
) {
  const unitId = Number(storageUnitId);
  const buyer = await assertWarehouseBuyerUser(userId, unitId, db);
  const buyerDisplayName = displayNameFromUserRow(buyer) || null;
  const date = toUtcDateOnly(effectiveDate);
  await db.lttpWarehouseBuyerTerm.upsert({
    where: { unitId_effectiveDate: { unitId, effectiveDate: date } },
    create: {
      unitId,
      effectiveDate: date,
      buyerUserId: buyer.id,
      createdById: Number(createdById),
    },
    update: { buyerUserId: buyer.id, createdById: Number(createdById) },
  });
  const updated = await db.lttpIssueSlip.updateMany({
    where: { unitId, issueDate: { gte: date } },
    data: { buyerUserId: buyer.id, buyerDisplayName },
  });
  await syncLatestDefaultBuyer(db, unitId);
  if (updated.count > 0) {
    await markChungTuDocumentsStaleForStorageUnit(unitId);
  }
  return {
    unitId,
    userId: buyer.id,
    buyerDisplayName,
    effectiveDate: date.toISOString().slice(0, 10),
    slipsUpdated: updated.count,
  };
}

/**
 * ponytail: one-shot để gán lại mọi phiếu đã phát hành. Xoá hàm này, route
 * POST /warehouse-buyer/rewrite-all và nút trên Admin LTTP sau lần cập nhật tới.
 * Trần: ghi đè mọi phiếu của kho, không sửa các mốc ngày. Nâng cấp: không có — xoá.
 */
export async function rewriteAllWarehouseSlipBuyers({ storageUnitId, userId }, db = defaultPrisma) {
  const unitId = Number(storageUnitId);
  const buyer = await assertWarehouseBuyerUser(userId, unitId, db);
  const buyerDisplayName = displayNameFromUserRow(buyer) || null;
  const updated = await db.lttpIssueSlip.updateMany({
    where: { unitId },
    data: { buyerUserId: buyer.id, buyerDisplayName },
  });
  await db.lttpUnitIssueFormDefaults.upsert({
    where: { unitId },
    create: { unitId, defaultBuyerUserId: buyer.id },
    update: { defaultBuyerUserId: buyer.id },
  });
  if (updated.count > 0) {
    await markChungTuDocumentsStaleForStorageUnit(unitId);
  }
  return {
    unitId,
    userId: buyer.id,
    buyerDisplayName,
    slipsUpdated: updated.count,
  };
}
