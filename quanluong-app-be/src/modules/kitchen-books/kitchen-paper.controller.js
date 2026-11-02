import { respondSuccess } from "../../shared/utils/responders.js";
import {
  getPaperIssue,
  getPaperOpening,
  getPaperReceipt,
  getPaperStock,
  putPaperIssue,
  putPaperOpening,
  putPaperReceipt,
} from "./kitchen-paper.service.js";

async function getPaperReceiptController(req, res) {
  const data = await getPaperReceipt(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải phiếu nhập", data });
}

async function putPaperReceiptController(req, res) {
  const data = await putPaperReceipt(
    req.validatedBody,
    req.user.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã ghi phiếu nhập", data });
}

async function getPaperIssueController(req, res) {
  const data = await getPaperIssue(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải phiếu xuất", data });
}

async function putPaperIssueController(req, res) {
  const data = await putPaperIssue(
    req.validatedBody,
    req.user.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã ghi phiếu xuất", data });
}

async function getPaperStockController(req, res) {
  const data = await getPaperStock(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải sổ theo dõi", data });
}

async function getPaperOpeningController(req, res) {
  const data = await getPaperOpening(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải tồn đầu kỳ", data });
}

async function putPaperOpeningController(req, res) {
  const data = await putPaperOpening(
    req.validatedBody,
    req.user.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã ghi tồn đầu kỳ", data });
}

export {
  getPaperIssueController,
  getPaperOpeningController,
  getPaperReceiptController,
  getPaperStockController,
  putPaperIssueController,
  putPaperOpeningController,
  putPaperReceiptController,
};
