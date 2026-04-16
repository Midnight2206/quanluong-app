import { PERMISSIONS } from "../../shared/constants/permissions.js";
import { MEAL_ROSTER_MODULE_NAME } from "./meal-roster.constants.js";

const MEAL_ROSTER_ROUTE_DEFINITIONS = [
  {
    key: "listMealRoster",
    method: "GET",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/",
    pathRoute: "/api/meal-roster",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster",
      description: "Xem và quản lý danh sách chấm cơm theo tháng (private đơn vị).",
    },
  },
  {
    key: "createMealRosterEntry",
    method: "POST",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/",
    pathRoute: "/api/meal-roster",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster",
      description: "Thêm dòng danh sách chấm cơm.",
    },
  },
  {
    key: "patchMealRosterEntry",
    method: "PATCH",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/meal-roster/:id",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster",
      description: "Sửa dòng danh sách chấm cơm.",
    },
  },
  {
    key: "deleteMealRosterEntry",
    method: "DELETE",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/meal-roster/:id",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster",
      description: "Xóa dòng danh sách chấm cơm.",
    },
  },
  {
    key: "importMealRoster",
    method: "POST",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/import",
    pathRoute: "/api/meal-roster/import",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster import",
      description: "Nhập danh sách chấm cơm từ Excel.",
    },
  },
  {
    key: "mealRosterMeta",
    method: "GET",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/meta",
    pathRoute: "/api/meal-roster/meta",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster meta",
      description: "Danh mục mức ăn tiêu chuẩn và đơn vị trực thuộc cho chấm cơm.",
    },
  },
  {
    key: "downloadMealRosterTemplate",
    method: "GET",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/import-template",
    pathRoute: "/api/meal-roster/import-template",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster template",
      description: "Tải file mẫu Excel chấm cơm (dropdown mức ăn tiêu chuẩn và đơn vị).",
    },
  },
  {
    key: "mealRateCatalog",
    method: "GET",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/rate-catalog",
    pathRoute: "/api/meal-roster/rate-catalog",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal rate catalog",
      description: "Danh mục toàn bộ mức tiền ăn Thông tư (chọn áp dụng cho đơn vị).",
    },
  },
  {
    key: "putSelectedMealRates",
    method: "PUT",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/selected-rates",
    pathRoute: "/api/meal-roster/selected-rates",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster selected rates",
      description: "Lưu tập mức tiền ăn được phép dùng cho đơn vị (danh sách bảo đảm, Excel, sổ chấm).",
    },
  },
  {
    key: "listMealRosterDayMarks",
    method: "GET",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/day-marks",
    pathRoute: "/api/meal-roster/day-marks",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster day marks",
      description: "Đọc sổ chấm cơm theo ngày trong tháng.",
    },
  },
  {
    key: "replaceMealRosterDayMarks",
    method: "PUT",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/day-marks",
    pathRoute: "/api/meal-roster/day-marks",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster save day marks",
      description: "Lưu sổ chấm cơm (ô theo ngày).",
    },
  },
  {
    key: "copyPreviousMealRoster",
    method: "POST",
    module: MEAL_ROSTER_MODULE_NAME,
    path: "/copy-previous",
    pathRoute: "/api/meal-roster/copy-previous",
    permission: {
      code: PERMISSIONS.MEAL_ROSTER_ACCESS,
      name: "Meal roster copy",
      description: "Sao chép danh sách chấm cơm từ tháng trước.",
    },
  },
];

export { MEAL_ROSTER_ROUTE_DEFINITIONS };
