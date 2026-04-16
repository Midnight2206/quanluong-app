import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import {
  createMealAllowanceRate,
  deleteMealAllowanceRate,
  listMealAllowanceRates,
  patchMealAllowanceRate,
} from "./meal-allowance-rates.service.js";

async function listMealAllowanceRatesController(_req, res) {
  const data = await listMealAllowanceRates();
  return respondSuccess(res, {
    message: "Đã tải danh mục mức tiền ăn",
    data,
  });
}

async function createMealAllowanceRateController(req, res) {
  const row = await createMealAllowanceRate(req.validatedBody);
  return respondCreated(res, {
    message: "Đã thêm mục",
    data: row,
  });
}

async function patchMealAllowanceRateController(req, res) {
  const row = await patchMealAllowanceRate(req.validatedParams.id, req.validatedBody);
  return respondSuccess(res, {
    message: "Đã cập nhật mục",
    data: row,
  });
}

async function deleteMealAllowanceRateController(req, res) {
  await deleteMealAllowanceRate(req.validatedParams.id);
  return respondSuccess(res, {
    message: "Đã xóa mục",
    data: null,
  });
}

export {
  createMealAllowanceRateController,
  deleteMealAllowanceRateController,
  listMealAllowanceRatesController,
  patchMealAllowanceRateController,
};
