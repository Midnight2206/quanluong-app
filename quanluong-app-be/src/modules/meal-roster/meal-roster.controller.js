import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import { mapMealRosterEntry } from "./meal-roster.mapper.js";
import {
  buildMealRosterImportTemplateBuffer,
  copyMealRosterFromPreviousMonth,
  createMealRosterEntry,
  deleteMealRosterEntry,
  getMealRosterMeta,
  importMealRosterFromExcel,
  listAllMealRatesForCatalog,
  listMealRosterDayMarks,
  listMealRosterEntries,
  patchMealRosterEntry,
  putUnitSelectedMealRates,
  replaceMealRosterDayMarks,
} from "./meal-roster.service.js";

async function listMealRosterController(req, res) {
  const { unitId, yearMonth } = req.validatedQuery;
  const rows = await listMealRosterEntries(unitId, yearMonth, req.unitScope, req.effectiveUnitIds);
  return respondSuccess(res, {
    message: "Đã tải danh sách chấm cơm",
    data: rows.map(mapMealRosterEntry),
  });
}

async function createMealRosterEntryController(req, res) {
  const row = await createMealRosterEntry(req.validatedBody, req.unitScope, req.effectiveUnitIds);
  return respondCreated(res, {
    message: "Đã thêm dòng",
    data: mapMealRosterEntry(row),
  });
}

async function patchMealRosterEntryController(req, res) {
  const row = await patchMealRosterEntry(
    req.validatedParams.id,
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondSuccess(res, {
    message: "Đã cập nhật",
    data: mapMealRosterEntry(row),
  });
}

async function deleteMealRosterEntryController(req, res) {
  const result = await deleteMealRosterEntry(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondSuccess(res, {
    message: "Đã xóa dòng",
    data: result,
  });
}

async function importMealRosterController(req, res) {
  const { unitId, yearMonth } = req.validatedBody;
  if (!req.file?.buffer) {
    throw new AppError({
      message: "Thiếu file Excel",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const rows = await importMealRosterFromExcel(
    { buffer: req.file.buffer, unitId, yearMonth },
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondCreated(res, {
    message: "Đã nhập từ Excel",
    data: rows.map(mapMealRosterEntry),
  });
}

async function copyPreviousMealRosterController(req, res) {
  const rows = await copyMealRosterFromPreviousMonth(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondSuccess(res, {
    message: "Đã sao chép từ tháng trước",
    data: rows.map(mapMealRosterEntry),
  });
}

async function mealRosterMetaController(req, res) {
  const { unitId, yearMonth } = req.validatedQuery;
  const data = await getMealRosterMeta(unitId, req.unitScope, req.effectiveUnitIds, yearMonth);
  return respondSuccess(res, {
    message: "Đã tải danh mục chấm cơm",
    data,
  });
}

async function mealRateCatalogController(_req, res) {
  const rates = await listAllMealRatesForCatalog();
  return respondSuccess(res, {
    message: "Đã tải danh mục mức tiền ăn",
    data: { rates },
  });
}

async function putSelectedMealRatesController(req, res) {
  const { unitId, mealAllowanceRateIds, selections, periodSplitValidFrom } = req.validatedBody;
  const rates = await putUnitSelectedMealRates(
    unitId,
    { mealAllowanceRateIds, selections, periodSplitValidFrom },
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondSuccess(res, {
    message: "Đã lưu mức tiền ăn áp dụng cho đơn vị",
    data: { rates },
  });
}

async function listDayMarksController(req, res) {
  const { unitId, yearMonth } = req.validatedQuery;
  const payload = await listMealRosterDayMarks(unitId, yearMonth, req.unitScope, req.effectiveUnitIds);
  return respondSuccess(res, {
    message: "OK",
    data: payload,
  });
}

async function replaceDayMarksController(req, res) {
  const payload = await replaceMealRosterDayMarks(req.validatedBody, req.unitScope, req.effectiveUnitIds);
  return respondSuccess(res, {
    message: "Đã lưu sổ chấm cơm",
    data: payload,
  });
}

async function downloadMealRosterTemplateController(req, res) {
  const { unitId } = req.validatedQuery;
  const buffer = await buildMealRosterImportTemplateBuffer(
    unitId,
    req.unitScope,
    req.effectiveUnitIds,
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="cham-com-mau-u${unitId}.xlsx"`,
  );
  return res.send(buffer);
}

export {
  copyPreviousMealRosterController,
  createMealRosterEntryController,
  deleteMealRosterEntryController,
  downloadMealRosterTemplateController,
  importMealRosterController,
  listDayMarksController,
  listMealRosterController,
  mealRateCatalogController,
  mealRosterMetaController,
  patchMealRosterEntryController,
  putSelectedMealRatesController,
  replaceDayMarksController,
};
