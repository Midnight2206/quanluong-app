import { z } from "zod";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import {
  applyLttpCommodityToDescendantUnit,
  applyLttpPriceTableToDescendantUnit,
  buildPriceImportTemplateBuffer,
  createCommodity,
  createFoodGroup,
  createIssueSlip,
  createLttpSupplier,
  createPriceTable,
  deleteCommodity,
  deleteFoodGroup,
  deleteIssueSlip,
  deleteLttpSupplier,
  deletePriceTable,
  getCommodityById,
  getEffectivePrices,
  putLttpCommodityDefaultSupplier,
  getDailyOrderSummary,
  getIssueFormDefaults,
  getIssueSlipById,
  getRecipientDefaultUserByUnit,
  getNextIssueSlipSerial,
  getPriceTableById,
  importPriceTableFromExcel,
  listCommodities,
  listLttpSuppliers,
  listFoodGroupsCatalog,
  listFoodGroupsForSelect,
  listIssueSlips,
  listPriceTables,
  listRecipientDefaultUsersInScope,
  listRecipientUsers,
  patchCommodity,
  patchFoodGroup,
  patchLttpSupplier,
  patchPriceTable,
  putRecipientDefaultUser,
  resolveIssueSlipLine,
  updateIssueSlip,
  upsertIssueFormDefaults,
} from "./lttp.service.js";

const importBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  note: z.string().max(500).optional().nullable(),
});

async function listFoodGroupsController(_req, res) {
  const rows = await listFoodGroupsForSelect();
  return respondSuccess(res, {
    message: "Đã tải nhóm LTTP",
    data: rows,
  });
}

async function listFoodGroupsCatalogController(_req, res) {
  const rows = await listFoodGroupsCatalog();
  return respondSuccess(res, {
    message: "Đã tải toàn bộ nhóm LTTP",
    data: rows,
  });
}

async function createFoodGroupController(req, res) {
  const row = await createFoodGroup(req.validatedBody);
  return respondCreated(res, {
    message: "Đã tạo nhóm",
    data: row,
  });
}

async function patchFoodGroupController(req, res) {
  const row = await patchFoodGroup(req.validatedParams.id, req.validatedBody);
  return respondSuccess(res, {
    message: "Đã cập nhật nhóm",
    data: row,
  });
}

async function deleteFoodGroupController(req, res) {
  await deleteFoodGroup(req.validatedParams.id);
  return respondSuccess(res, {
    message: "Đã xóa nhóm",
    data: null,
  });
}

async function listCommoditiesController(req, res) {
  const rows = await listCommodities(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tải danh sách mặt hàng",
    data: rows,
  });
}

async function listLttpSuppliersController(req, res) {
  const rows = await listLttpSuppliers(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tải danh sách đối tác cung cấp",
    data: rows,
  });
}

async function putLttpCommodityDefaultSupplierController(req, res) {
  const data = await putLttpCommodityDefaultSupplier(
    { commodityId: req.validatedParams.id, ...req.validatedBody },
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã cập nhật đối tác mặc định theo mặt hàng",
    data,
  });
}

async function createLttpSupplierController(req, res) {
  const row = await createLttpSupplier(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondCreated(res, {
    message: "Đã tạo đối tác",
    data: row,
  });
}

async function patchLttpSupplierController(req, res) {
  const row = await patchLttpSupplier(
    req.validatedParams.id,
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã cập nhật đối tác",
    data: row,
  });
}

async function deleteLttpSupplierController(req, res) {
  await deleteLttpSupplier(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã xóa đối tác",
    data: null,
  });
}

async function getCommodityController(req, res) {
  const row = await getCommodityById(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tải mặt hàng",
    data: row,
  });
}

async function createCommodityController(req, res) {
  const row = await createCommodity(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondCreated(res, {
    message: "Đã tạo mặt hàng",
    data: row,
  });
}

async function patchCommodityController(req, res) {
  const row = await patchCommodity(
    req.validatedParams.id,
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã cập nhật mặt hàng",
    data: row,
  });
}

async function deleteCommodityController(req, res) {
  await deleteCommodity(req.validatedParams.id, req.unitScope, req.effectiveUnitIds, req.dataScope);
  return respondSuccess(res, {
    message: "Đã xóa mặt hàng",
    data: null,
  });
}

async function applyLttpCommodityToUnitController(req, res) {
  const body = req.validatedBody;
  const rawIds =
    body.targetUnitIds != null && body.targetUnitIds.length > 0
      ? body.targetUnitIds
      : body.targetUnitId != null
        ? [body.targetUnitId]
        : [];
  const targetUnitIds = [...new Set(rawIds.map((n) => Number(n)))];
  const results = [];
  for (const targetUnitId of targetUnitIds) {
    const row = await applyLttpCommodityToDescendantUnit(
      req.validatedParams.id,
      targetUnitId,
      req.user,
      req.unitScope,
      req.effectiveUnitIds,
      req.dataScope,
    );
    results.push(row);
  }
  if (results.length === 1) {
    return respondSuccess(res, {
      message: "Đã áp mặt hàng xuống đơn vị con (tạo mới hoặc đồng bộ)",
      data: results[0],
    });
  }
  return respondSuccess(res, {
    message: `Đã áp mặt hàng xuống ${results.length} đơn vị con.`,
    data: { results },
  });
}

async function effectivePricesController(req, res) {
  const data = await getEffectivePrices(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tải giá hiệu lực",
    data,
  });
}

async function listPriceTablesController(req, res) {
  const rows = await listPriceTables(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tải phiên bản bảng giá",
    data: rows,
  });
}

async function getPriceTableController(req, res) {
  const row = await getPriceTableById(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tải bảng giá",
    data: row,
  });
}

async function createPriceTableController(req, res) {
  const row = await createPriceTable(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondCreated(res, {
    message: "Đã lưu bảng giá",
    data: row,
  });
}

async function patchPriceTableController(req, res) {
  const row = await patchPriceTable(
    req.validatedParams.id,
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã cập nhật bảng giá",
    data: row,
  });
}

async function deletePriceTableController(req, res) {
  await deletePriceTable(req.validatedParams.id, req.unitScope, req.effectiveUnitIds, req.dataScope);
  return respondSuccess(res, {
    message: "Đã xóa phiên bản bảng giá",
    data: null,
  });
}

async function applyLttpPriceTableToUnitController(req, res) {
  const body = req.validatedBody;
  const rawIds =
    body.targetUnitIds != null && body.targetUnitIds.length > 0
      ? body.targetUnitIds
      : body.targetUnitId != null
        ? [body.targetUnitId]
        : [];
  const targetUnitIds = [...new Set(rawIds.map((n) => Number(n)))];
  const results = [];
  const targetEffectiveDate = body.targetEffectiveDate;
  for (const targetUnitId of targetUnitIds) {
    const row = await applyLttpPriceTableToDescendantUnit(
      req.validatedParams.id,
      targetUnitId,
      req.user,
      req.unitScope,
      req.effectiveUnitIds,
      req.dataScope,
      targetEffectiveDate,
    );
    results.push(row);
  }
  if (results.length === 1) {
    return respondSuccess(res, {
      message:
        "Đã áp bảng giá xuống đơn vị con (đồng bộ mặt hàng trong từng dòng, tạo/update bảng đích theo fork)",
      data: results[0],
    });
  }
  return respondSuccess(res, {
    message: `Đã áp bảng giá xuống ${results.length} đơn vị con.`,
    data: { results },
  });
}

async function importPriceTableController(req, res) {
  const parsed = importBodySchema.safeParse({
    unitId: req.body?.unitId,
    effectiveDate: req.body?.effectiveDate,
    note: req.body?.note ?? null,
  });
  if (!parsed.success) {
    throw new AppError({
      message: "Cần unitId, effectiveDate (YYYY-MM-DD) và file .xlsx",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (!req.file?.buffer) {
    throw new AppError({
      message: "Thiếu file Excel",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const row = await importPriceTableFromExcel(
    {
      buffer: req.file.buffer,
      unitId: parsed.data.unitId,
      effectiveDate: parsed.data.effectiveDate,
      note: parsed.data.note,
    },
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondCreated(res, {
    message: "Đã nhập bảng giá từ Excel",
    data: row,
  });
}

async function downloadPriceImportTemplateController(req, res) {
  const { unitId, date } = req.validatedQuery;
  const buffer = await buildPriceImportTemplateBuffer(
    { unitId, date },
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  const safeDate = String(date).slice(0, 10);
  const filename = `lttp-mau-banggia-u${unitId}-${safeDate}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

async function listIssueSlipsController(req, res) {
  const data = await listIssueSlips(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tải danh sách phiếu xuất",
    data,
  });
}

async function getDailyOrderSummaryController(req, res) {
  const data = await getDailyOrderSummary(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tổng hợp đặt hàng theo phiếu xuất",
    data,
  });
}

async function resolveIssueSlipLineController(req, res) {
  const data = await resolveIssueSlipLine(
    { unitId: req.validatedQuery.unitId, date: req.validatedQuery.date, code: req.validatedQuery.code },
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tra mã mặt hàng & giá",
    data,
  });
}

async function getIssueSlipController(req, res) {
  const row = await getIssueSlipById(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã tải phiếu xuất",
    data: row,
  });
}

async function createIssueSlipController(req, res) {
  const row = await createIssueSlip(
    req.validatedBody,
    req.user.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondCreated(res, {
    message: "Đã lưu phiếu xuất",
    data: row,
  });
}

async function deleteIssueSlipController(req, res) {
  await deleteIssueSlip(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã xóa phiếu xuất",
    data: null,
  });
}

async function updateIssueSlipController(req, res) {
  const row = await updateIssueSlip(
    req.validatedParams.id,
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Đã cập nhật phiếu xuất",
    data: row,
  });
}

async function getNextIssueSlipSerialController(req, res) {
  const data = await getNextIssueSlipSerial(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Số dự kiến (quyển theo tháng/năm)", data });
}

async function getIssueFormDefaultsController(req, res) {
  const data = await getIssueFormDefaults(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Cấu hình mẫu in", data });
}

async function putIssueFormDefaultsController(req, res) {
  const data = await upsertIssueFormDefaults(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã lưu mẫu in", data });
}

async function listRecipientUsersController(req, res) {
  const data = await listRecipientUsers(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondSuccess(res, { message: "Danh sách user theo đơn vị", data });
}

async function getRecipientDefaultUserByUnitController(req, res) {
  const data = await getRecipientDefaultUserByUnit(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondSuccess(res, { message: "Người nhận mặc định theo đơn vị nhận", data });
}

async function listRecipientDefaultUsersInScopeController(req, res) {
  const data = await listRecipientDefaultUsersInScope(req.effectiveUnitIds);
  return respondSuccess(res, { message: "Danh sách cấu hình theo đơn vị nhận", data });
}

async function putRecipientDefaultUserController(req, res) {
  const data = await putRecipientDefaultUser(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondSuccess(res, { message: "Đã lưu người nhận mặc định theo đơn vị nhận", data });
}

export {
  applyLttpCommodityToUnitController,
  applyLttpPriceTableToUnitController,
  createCommodityController,
  createFoodGroupController,
  createIssueSlipController,
  createPriceTableController,
  deleteCommodityController,
  deleteFoodGroupController,
  deleteIssueSlipController,
  deletePriceTableController,
  downloadPriceImportTemplateController,
  effectivePricesController,
  getCommodityController,
  putLttpCommodityDefaultSupplierController,
  getIssueFormDefaultsController,
  getDailyOrderSummaryController,
  getRecipientDefaultUserByUnitController,
  getIssueSlipController,
  getNextIssueSlipSerialController,
  getPriceTableController,
  importPriceTableController,
  listCommoditiesController,
  listLttpSuppliersController,
  createLttpSupplierController,
  patchLttpSupplierController,
  deleteLttpSupplierController,
  listFoodGroupsCatalogController,
  listFoodGroupsController,
  listIssueSlipsController,
  listPriceTablesController,
  listRecipientDefaultUsersInScopeController,
  listRecipientUsersController,
  patchCommodityController,
  patchFoodGroupController,
  patchPriceTableController,
  putIssueFormDefaultsController,
  putRecipientDefaultUserController,
  resolveIssueSlipLineController,
  updateIssueSlipController,
};
