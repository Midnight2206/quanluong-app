import { PERMISSIONS } from "../../shared/constants/permissions.js";
import { CHUNG_TU_QUYET_TOAN_MODULE_NAME } from "./chung-tu-quyet-toan.constants.js";

const CHUNG_TU_QUYET_TOAN_ROUTE_DEFINITIONS = [
  {
    key: "health",
    method: "GET",
    module: CHUNG_TU_QUYET_TOAN_MODULE_NAME,
    path: "/health",
    pathRoute: "/api/chungtuquyettoan/health",
    permission: {
      code: PERMISSIONS.LTTP_ISSUE_SLIPS_READ,
      name: "Chứng từ quyết toán",
      description: "Truy cập hệ thống API chứng từ quyết toán.",
    },
  },
];

export { CHUNG_TU_QUYET_TOAN_ROUTE_DEFINITIONS };
