import { PERMISSIONS } from "../../shared/constants/permissions.js";

const SYSTEM_INFRA_ROUTE_DEFINITIONS = [
  {
    key: "getSystemInfra",
    method: "GET",
    module: "systemInfra",
    path: "/",
    pathRoute: "/api/system-infra",
    permission: {
      code: PERMISSIONS.SYSTEM_INFRA_MANAGE,
      name: "Xem hạ tầng và khởi động lại container",
      description: "Xem đĩa và trạng thái container.",
    },
  },
  {
    key: "restartSystemInfra",
    method: "POST",
    module: "systemInfra",
    path: "/containers/:name/restart",
    pathRoute: "/api/system-infra/containers/:name/restart",
    permission: {
      code: PERMISSIONS.SYSTEM_INFRA_MANAGE,
      name: "Xem hạ tầng và khởi động lại container",
      description: "Khởi động lại một container.",
    },
  },
];

export { SYSTEM_INFRA_ROUTE_DEFINITIONS };
