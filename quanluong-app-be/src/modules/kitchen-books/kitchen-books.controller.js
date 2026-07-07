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
};
