import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

function mapProfileRow(row, unitName, issueDefaults) {
  const base = {
    unitId: row?.unitId ?? issueDefaults?.unitId,
    unitName: unitName ?? null,
    donViCapTren: row?.donViCapTren ?? null,
    boPhan: row?.boPhan ?? null,
    quyenSo: row?.quyenSo ?? null,
    noTaiKhoan: row?.noTaiKhoan ?? null,
    coTaiKhoan: row?.coTaiKhoan ?? null,
    signerLabelWriter: row?.signerLabelWriter ?? null,
    signerLabelApprover: row?.signerLabelApprover ?? null,
    signerLabelThird: row?.signerLabelThird ?? null,
    signerWriter: row?.signerWriter ?? issueDefaults?.signerWriter ?? null,
    signerApprover: row?.signerApprover ?? issueDefaults?.signerApprover ?? null,
    signerThird: row?.signerThird ?? null,
    signerNguoiMua:
      row?.signerNguoiMua ?? issueDefaults?.defaultBuyerUserName ?? null,
    signerPhuTrachBoPhan: row?.signerPhuTrachBoPhan ?? null,
    signerTaiChinh: row?.signerTaiChinh ?? null,
    donViSo: issueDefaults?.printLine1 ?? null,
    printLine2: issueDefaults?.printLine2 ?? null,
    warehouseFrom: issueDefaults?.warehouseFrom ?? null,
  };
  return base;
}

async function loadIssueDefaults(unitId) {
  const [unit, defaults] = await Promise.all([
    prisma.unit.findUnique({ where: { id: unitId }, select: { id: true, name: true } }),
    prisma.lttpUnitIssueFormDefaults.findUnique({
      where: { unitId },
      include: {
        defaultBuyerUser: {
          select: { id: true, username: true, profile: { select: { fullName: true } } },
        },
      },
    }),
  ]);
  if (!unit) {
    throw new AppError({
      message: "Không tìm thấy đơn vị.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const buyerUser = defaults?.defaultBuyerUser;
  const defaultBuyerUserName = buyerUser
    ? String(buyerUser.profile?.fullName ?? "").trim() || String(buyerUser.username ?? "").trim()
    : null;
  return {
    unitId: unit.id,
    unitName: unit.name,
    printLine1: defaults?.printLine1 ?? null,
    printLine2: defaults?.printLine2 ?? null,
    formMauSo: defaults?.formMauSo ?? null,
    warehouseFrom: defaults?.warehouseFrom ?? null,
    signerWriter: defaults?.signerWriter ?? null,
    signerApprover: defaults?.signerApprover ?? null,
    defaultBuyerUserId: defaults?.defaultBuyerUserId ?? null,
    defaultBuyerUserName: defaultBuyerUserName || null,
  };
}

async function getChungTuUnitProfile({ unitId }) {
  const uid = Number(unitId);
  const issueDefaults = await loadIssueDefaults(uid);
  const row = await prisma.chungTuUnitProfile.findUnique({ where: { unitId: uid } });
  return mapProfileRow(row, issueDefaults.unitName, issueDefaults);
}

async function putChungTuUnitProfile({ unitId, payload }) {
  const uid = Number(unitId);
  await loadIssueDefaults(uid);
  const data = {
    donViCapTren: payload.donViCapTren ?? null,
    boPhan: payload.boPhan ?? null,
    quyenSo: payload.quyenSo ?? null,
    noTaiKhoan: payload.noTaiKhoan ?? null,
    coTaiKhoan: payload.coTaiKhoan ?? null,
    signerLabelWriter: payload.signerLabelWriter ?? null,
    signerLabelApprover: payload.signerLabelApprover ?? null,
    signerLabelThird: payload.signerLabelThird ?? null,
    signerWriter: payload.signerWriter ?? null,
    signerApprover: payload.signerApprover ?? null,
    signerThird: payload.signerThird ?? null,
    signerNguoiMua: payload.signerNguoiMua ?? null,
    signerPhuTrachBoPhan: payload.signerPhuTrachBoPhan ?? null,
    signerTaiChinh: payload.signerTaiChinh ?? null,
  };
  const row = await prisma.chungTuUnitProfile.upsert({
    where: { unitId: uid },
    create: { unitId: uid, ...data },
    update: data,
  });
  const issueDefaults = await loadIssueDefaults(uid);
  return mapProfileRow(row, issueDefaults.unitName, issueDefaults);
}

export { getChungTuUnitProfile, putChungTuUnitProfile };
