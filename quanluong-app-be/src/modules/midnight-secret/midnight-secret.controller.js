import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { respondSuccess } from "../../shared/utils/responders.js";
import {
  createLttpPartnerPayment,
  getLttpPartnerMoneyMatrix,
  getLttpPartnerPeriodSupplierTotals,
  getLttpPartnerPriceEditorData,
  listLttpPartnerDebtSummary,
  listLttpPartnerPayments,
  putLttpPartnerPriceTableUnscoped,
} from "../lttp/lttp.service.js";

function getCurrentUserUnitId(req) {
  const unitId = Number(req.midnightUserUnitId);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    throw new AppError({
      message: "Tài khoản hiện tại chưa gắn đơn vị để thống kê LTTP",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
  return unitId;
}

async function listActiveUnitsForMidnight(req, res) {
  const unitId = getCurrentUserUnitId(req);
  const rows = await prisma.unit.findMany({
    where: { id: unitId, isActive: true },
    orderBy: [{ path: "asc" }, { name: "asc" }],
    select: { id: true, name: true, path: true, depth: true },
  });
  return respondSuccess(res, {
    message: "Đơn vị cấp của user hiện tại",
    data: rows,
  });
}

async function getLttpPartnerPeriodTotalsController(req, res) {
  const unitId = getCurrentUserUnitId(req);
  const data = await getLttpPartnerPeriodSupplierTotals({ ...req.validatedQuery, unitId });
  return respondSuccess(res, {
    message: "Tổng theo đối tác (bảng giá đối tác tách bảng LTTP gốc)",
    data,
  });
}

async function getLttpSuppliersForMidnightController(req, res) {
  const unitId = getCurrentUserUnitId(req);
  const rows = await prisma.lttpSupplier.findMany({
    where: { unitId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return respondSuccess(res, { message: "Đối tác theo kho", data: rows });
}

async function getPartnerPriceEditorController(req, res) {
  const unitId = getCurrentUserUnitId(req);
  const data = await getLttpPartnerPriceEditorData({ ...req.validatedQuery, unitId });
  return respondSuccess(res, { message: "Bảng giá đối tác tại ngày tham chiếu", data });
}

async function putPartnerPriceTableController(req, res) {
  const unitId = getCurrentUserUnitId(req);
  const data = await putLttpPartnerPriceTableUnscoped({ ...req.validatedBody, unitId });
  return respondSuccess(res, { message: "Đã lưu bảng giá đối tác", data });
}

async function getLttpPartnerMoneyMatrixController(req, res) {
  const unitId = getCurrentUserUnitId(req);
  const data = await getLttpPartnerMoneyMatrix({ ...req.validatedQuery, unitId });
  return respondSuccess(res, { message: "Báo cáo theo ngày & đơn vị nhận", data });
}

async function getPartnerDebtSummaryController(req, res) {
  const unitId = getCurrentUserUnitId(req);
  const data = await listLttpPartnerDebtSummary({ unitId });
  return respondSuccess(res, { message: "Công nợ đối tác", data });
}

async function listPartnerPaymentsController(req, res) {
  const unitId = getCurrentUserUnitId(req);
  const data = await listLttpPartnerPayments({
    unitId,
    lttpSupplierId: req.validatedParams.supplierId,
  });
  return respondSuccess(res, { message: "Lịch sử thanh toán đối tác", data });
}

async function createPartnerPaymentController(req, res) {
  const unitId = getCurrentUserUnitId(req);
  const data = await createLttpPartnerPayment({
    unitId,
    lttpSupplierId: req.validatedParams.supplierId,
    ...req.validatedBody,
  });
  return respondSuccess(res, { statusCode: 201, message: "Đã ghi nhận thanh toán", data });
}

export {
  createPartnerPaymentController,
  getLttpPartnerMoneyMatrixController,
  getLttpPartnerPeriodTotalsController,
  getLttpSuppliersForMidnightController,
  getPartnerDebtSummaryController,
  getPartnerPriceEditorController,
  listActiveUnitsForMidnight,
  listPartnerPaymentsController,
  putPartnerPriceTableController,
};
