import { PERMISSIONS } from "../../shared/constants/permissions.js";

const MODULE_NAME = "unitLevelCaps";

const UNIT_LEVEL_PERMISSION_CAPS_ROUTE_DEFINITIONS = [
  {
    key: "listUnitLevelPermissionCaps",
    method: "GET",
    module: MODULE_NAME,
    path: "/",
    pathRoute: "/api/unit-level-permission-caps",
    permission: {
      code: PERMISSIONS.UNIT_LEVEL_CAPS_READ,
      name: "View permission caps by unit depth",
      description: "Read the matrix of allowed permissions per organizational depth.",
    },
  },
  {
    key: "getUnitLevelPermissionCapsByDepth",
    method: "GET",
    module: MODULE_NAME,
    path: "/:depth",
    pathRoute: "/api/unit-level-permission-caps/:depth",
    permission: {
      code: PERMISSIONS.UNIT_LEVEL_CAPS_READ,
      name: "View permission cap row for one depth",
      description: "Read allowed permission ids for a single depth level.",
    },
  },
  {
    key: "replaceUnitLevelPermissionCaps",
    method: "PUT",
    module: MODULE_NAME,
    path: "/:depth",
    pathRoute: "/api/unit-level-permission-caps/:depth",
    permission: {
      code: PERMISSIONS.UNIT_LEVEL_CAPS_MANAGE,
      name: "Manage permission caps by unit depth",
      description: "Replace the set of allowed permissions for one depth level.",
    },
  },
];

export { UNIT_LEVEL_PERMISSION_CAPS_ROUTE_DEFINITIONS };
