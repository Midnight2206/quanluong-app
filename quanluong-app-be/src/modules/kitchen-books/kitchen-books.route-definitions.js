import { PERMISSIONS } from "../../shared/constants/permissions.js";
import { KITCHEN_BOOKS_MODULE_NAME } from "./kitchen-books.constants.js";

const KITCHEN_BOOKS_ROUTE_DEFINITIONS = [
  {
    key: "listKitchenCatalog",
    method: "GET",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/catalog",
    pathRoute: "/api/kitchen-books/catalog",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Xem danh mục món bếp ăn.",
    },
  },
  {
    key: "getKitchenCatalog",
    method: "GET",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/catalog/:id",
    pathRoute: "/api/kitchen-books/catalog/:id",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Xem chi tiết món trong danh mục.",
    },
  },
  {
    key: "createKitchenCatalog",
    method: "POST",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/catalog",
    pathRoute: "/api/kitchen-books/catalog",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Thêm món vào danh mục bếp ăn.",
    },
  },
  {
    key: "updateKitchenCatalog",
    method: "PUT",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/catalog/:id",
    pathRoute: "/api/kitchen-books/catalog/:id",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Sửa món trong danh mục bếp ăn.",
    },
  },
  {
    key: "deleteKitchenCatalog",
    method: "DELETE",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/catalog/:id",
    pathRoute: "/api/kitchen-books/catalog/:id",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Xóa món khỏi danh mục bếp ăn.",
    },
  },
  {
    key: "getKitchenMenu",
    method: "GET",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/menu",
    pathRoute: "/api/kitchen-books/menu",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Xem thực đơn ngày.",
    },
  },
  {
    key: "putKitchenMenu",
    method: "PUT",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/menu",
    pathRoute: "/api/kitchen-books/menu",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Lưu thực đơn một buổi.",
    },
  },
  {
    key: "importKitchenCatalogToMenu",
    method: "POST",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/menu/import-catalog",
    pathRoute: "/api/kitchen-books/menu/import-catalog",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Thêm món từ danh mục vào thực đơn ngày.",
    },
  },
  {
    key: "kitchenMenuMonthMarkers",
    method: "GET",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/menu/month-markers",
    pathRoute: "/api/kitchen-books/menu/month-markers",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Đánh dấu ngày có thực đơn trong tháng.",
    },
  },
  {
    key: "deleteKitchenMenuDish",
    method: "DELETE",
    module: KITCHEN_BOOKS_MODULE_NAME,
    path: "/menu/dish/:dishId",
    pathRoute: "/api/kitchen-books/menu/dish/:dishId",
    permission: {
      code: PERMISSIONS.KITCHEN_BOOKS_ACCESS,
      name: "Kitchen books",
      description: "Xóa món trên thực đơn ngày.",
    },
  },
];

export { KITCHEN_BOOKS_ROUTE_DEFINITIONS };
