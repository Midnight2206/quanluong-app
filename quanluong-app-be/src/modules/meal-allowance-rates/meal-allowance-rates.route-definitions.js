import { PERMISSIONS } from "../../shared/constants/permissions.js";

const MODULE_NAME = "mealAllowanceRates";

const MEAL_ALLOWANCE_RATES_ROUTE_DEFINITIONS = [
  {
    key: "listMealAllowanceRates",
    method: "GET",
    module: MODULE_NAME,
    path: "/",
    pathRoute: "/api/meal-allowance-rates",
    permission: null,
  },
  {
    key: "createMealAllowanceRate",
    method: "POST",
    module: MODULE_NAME,
    path: "/",
    pathRoute: "/api/meal-allowance-rates",
    permission: {
      code: PERMISSIONS.MEAL_ALLOWANCE_RATES_MANAGE,
      name: "Manage meal allowance rate catalog",
      description: "Tạo, sửa, xóa mục mức tiền ăn (dữ liệu công khai theo thông tư).",
    },
  },
  {
    key: "patchMealAllowanceRate",
    method: "PATCH",
    module: MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/meal-allowance-rates/:id",
    permission: {
      code: PERMISSIONS.MEAL_ALLOWANCE_RATES_MANAGE,
      name: "Manage meal allowance rate catalog",
      description: "Tạo, sửa, xóa mục mức tiền ăn (dữ liệu công khai theo thông tư).",
    },
  },
  {
    key: "deleteMealAllowanceRate",
    method: "DELETE",
    module: MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/meal-allowance-rates/:id",
    permission: {
      code: PERMISSIONS.MEAL_ALLOWANCE_RATES_MANAGE,
      name: "Manage meal allowance rate catalog",
      description: "Tạo, sửa, xóa mục mức tiền ăn (dữ liệu công khai theo thông tư).",
    },
  },
];

export { MEAL_ALLOWANCE_RATES_ROUTE_DEFINITIONS };
