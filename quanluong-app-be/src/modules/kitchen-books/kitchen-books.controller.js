import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import {
  createCatalog,
  deleteCatalog,
  getCatalogById,
  listCatalog,
  updateCatalog,
} from "./kitchen-books-catalog.service.js";
import {
  deleteMenuDish,
  getMenuDay,
  importCatalogToPeriod,
  listMenuMonthMarkers,
  putMenuPeriod,
} from "./kitchen-books-menu.service.js";
import {
  createKitchenReceiptSlip,
  deleteKitchenReceiptSlip,
  getKitchenReceiptGuaranteeFromIssueSlips,
  getKitchenReceiptSlipByDay,
  getKitchenReceiptSlipById,
  getNextKitchenReceiptSlipSerial,
  listKitchenReceiptSlips,
  resolveIssueSlipLine,
  updateKitchenReceiptSlip,
  upsertKitchenReceiptUnitSelfLines,
} from "./kitchen-books-receipt-slip.service.js";

async function listCatalogController(req, res) {
  const data = await listCatalog(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải danh mục món", data });
}

async function getCatalogController(req, res) {
  const data = await getCatalogById(
    req.validatedParams.id,
    req.validatedQuery.unitId,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải món", data });
}

async function createCatalogController(req, res) {
  const data = await createCatalog(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondCreated(res, { message: "Đã thêm món vào danh mục", data });
}

async function updateCatalogController(req, res) {
  const data = await updateCatalog(
    req.validatedParams.id,
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã cập nhật món", data });
}

async function deleteCatalogController(req, res) {
  const data = await deleteCatalog(
    req.validatedParams.id,
    req.validatedQuery.unitId,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã xóa món", data });
}

async function getMenuController(req, res) {
  const data = await getMenuDay(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải thực đơn ngày", data });
}

async function putMenuController(req, res) {
  const data = await putMenuPeriod(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã lưu thực đơn", data });
}

async function importCatalogController(req, res) {
  const data = await importCatalogToPeriod(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã thêm món từ danh mục", data });
}

async function monthMarkersController(req, res) {
  const data = await listMenuMonthMarkers(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải đánh dấu tháng", data });
}

async function deleteMenuDishController(req, res) {
  const data = await deleteMenuDish(
    req.validatedParams.dishId,
    req.validatedQuery.unitId,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã xóa món khỏi thực đơn", data });
}

async function listReceiptSlipsController(req, res) {
  const data = await listKitchenReceiptSlips(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải phiếu nhập kho", data });
}

async function getReceiptSlipByDayController(req, res) {
  const data = await getKitchenReceiptSlipByDay(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: data ? "Đã tải phiếu nhập kho trong ngày" : "Chưa có phiếu nhập kho trong ngày",
    data,
  });
}

async function upsertReceiptSlipUnitSelfController(req, res) {
  const data = await upsertKitchenReceiptUnitSelfLines(
    req.validatedBody,
    req.user.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã lưu dòng đơn vị tự bảo đảm", data });
}

async function getReceiptSlipController(req, res) {
  const data = await getKitchenReceiptSlipById(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải phiếu nhập kho", data });
}

async function createReceiptSlipController(req, res) {
  const data = await createKitchenReceiptSlip(
    req.validatedBody,
    req.user.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondCreated(res, { message: "Đã lưu phiếu nhập kho", data });
}

async function updateReceiptSlipController(req, res) {
  const data = await updateKitchenReceiptSlip(
    req.validatedParams.id,
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã cập nhật phiếu nhập kho", data });
}

async function deleteReceiptSlipController(req, res) {
  const data = await deleteKitchenReceiptSlip(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã xóa phiếu nhập kho", data });
}

async function nextReceiptSlipSerialController(req, res) {
  const data = await getNextKitchenReceiptSlipSerial(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải số phiếu kế tiếp", data });
}

async function resolveReceiptLineController(req, res) {
  const data = await resolveIssueSlipLine(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tra mã mặt hàng", data });
}

async function guaranteeFromIssueController(req, res) {
  const data = await getKitchenReceiptGuaranteeFromIssueSlips(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tải số lượng Trên BĐ từ phiếu xuất LTTP",
    data,
  });
}

export {
  listCatalogController,
  getCatalogController,
  createCatalogController,
  updateCatalogController,
  deleteCatalogController,
  getMenuController,
  putMenuController,
  importCatalogController,
  monthMarkersController,
  deleteMenuDishController,
  listReceiptSlipsController,
  getReceiptSlipByDayController,
  upsertReceiptSlipUnitSelfController,
  getReceiptSlipController,
  createReceiptSlipController,
  updateReceiptSlipController,
  deleteReceiptSlipController,
  nextReceiptSlipSerialController,
  resolveReceiptLineController,
  guaranteeFromIssueController,
};
