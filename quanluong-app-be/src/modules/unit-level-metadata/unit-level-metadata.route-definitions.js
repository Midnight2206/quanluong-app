import { PERMISSIONS } from "../../shared/constants/permissions.js";

const UNIT_LEVEL_MODULE_NAME = "unitLevel";

const UNIT_LEVEL_ROUTE_DEFINITIONS = [
  {
    key: "listUnitLevelMetadata",
    method: "GET",
    module: UNIT_LEVEL_MODULE_NAME,
    path: "/",
    pathRoute: "/api/unit-level-metadata",
    permission: {
      code: PERMISSIONS.UNIT_LEVEL_READ,
      name: "View unit level descriptions",
      description: "Read metadata texts per organizational depth.",
    },
  },
  {
    key: "upsertUnitLevelMetadata",
    method: "PUT",
    module: UNIT_LEVEL_MODULE_NAME,
    path: "/:depth",
    pathRoute: "/api/unit-level-metadata/:depth",
    permission: {
      code: PERMISSIONS.UNIT_LEVEL_MANAGE,
      name: "Manage unit level descriptions",
      description: "Upsert label/description for one depth level (superadmin).",
    },
  },
];

export { UNIT_LEVEL_ROUTE_DEFINITIONS };
