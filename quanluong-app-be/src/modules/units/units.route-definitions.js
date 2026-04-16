import { UNITS_MODULE_NAME, UNITS_PERMISSIONS } from "./units.constants.js";

const UNITS_ROUTE_DEFINITIONS = [
  {
    key: "listUnits",
    method: "GET",
    module: UNITS_MODULE_NAME,
    path: "/",
    pathRoute: "/api/units",
    permission: {
      code: UNITS_PERMISSIONS.LIST,
      name: "View units",
      description: "View organizational units in allowed scope.",
    },
  },
  {
    key: "getUnitDetail",
    method: "GET",
    module: UNITS_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/units/:id",
    permission: {
      code: UNITS_PERMISSIONS.DETAIL,
      name: "View unit detail",
      description: "View one unit including tree metadata.",
    },
  },
  {
    key: "createUnit",
    method: "POST",
    module: UNITS_MODULE_NAME,
    path: "/",
    pathRoute: "/api/units",
    permission: {
      code: UNITS_PERMISSIONS.CREATE,
      name: "Create unit",
      description: "Create a unit node under an optional parent.",
    },
  },
  {
    key: "patchUnit",
    method: "PATCH",
    module: UNITS_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/units/:id",
    permission: {
      code: UNITS_PERMISSIONS.PATCH,
      name: "Update unit",
      description: "Update unit fields, parent, or active state.",
    },
  },
  {
    key: "deleteUnit",
    method: "DELETE",
    module: UNITS_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/units/:id",
    permission: {
      code: UNITS_PERMISSIONS.DELETE,
      name: "Deactivate unit",
      description: "Soft-deactivate a unit when it has no users or child units.",
    },
  },
  {
    key: "listPrivateDataShares",
    method: "GET",
    module: UNITS_MODULE_NAME,
    path: "/private-data-shares",
    pathRoute: "/api/units/private-data-shares",
    permission: {
      code: UNITS_PERMISSIONS.PRIVATE_DATA_SHARE_LIST,
      name: "List unit private data share grants",
      description: "Danh sách gán quyền đọc dữ liệu private từ đơn vị mình xuống đơn vị con.",
    },
  },
  {
    key: "createPrivateDataShare",
    method: "POST",
    module: UNITS_MODULE_NAME,
    path: "/private-data-shares",
    pathRoute: "/api/units/private-data-shares",
    permission: {
      code: UNITS_PERMISSIONS.PRIVATE_DATA_SHARE_CREATE,
      name: "Create private data share grants",
      description: "Tạo gán quyền đọc bản ghi private (hoặc cả loại) cho đơn vị cấp dưới.",
    },
  },
  {
    key: "revokePrivateDataShare",
    method: "PATCH",
    module: UNITS_MODULE_NAME,
    path: "/private-data-shares/:grantId/revoke",
    pathRoute: "/api/units/private-data-shares/:grantId/revoke",
    permission: {
      code: UNITS_PERMISSIONS.PRIVATE_DATA_SHARE_REVOKE,
      name: "Revoke private data share grant",
      description: "Thu hồi (đóng hiệu lực) một gán chia sẻ private.",
    },
  },
];

export { UNITS_ROUTE_DEFINITIONS };
