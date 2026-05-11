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
  {
    key: "driveTemplates",
    method: "GET",
    module: CHUNG_TU_QUYET_TOAN_MODULE_NAME,
    path: "/drive-templates",
    pathRoute: "/api/chungtuquyettoan/drive-templates",
    permission: {
      code: PERMISSIONS.LTTP_ISSUE_SLIPS_READ,
      name: "Chứng từ quyết toán",
      description: "Truy cập hệ thống API chứng từ quyết toán.",
    },
  },
  {
    key: "sheetNamedRanges",
    method: "GET",
    module: CHUNG_TU_QUYET_TOAN_MODULE_NAME,
    path: "/spreadsheet-named-ranges/:driveFileId",
    pathRoute: "/api/chungtuquyettoan/spreadsheet-named-ranges/:driveFileId",
    permission: {
      code: PERMISSIONS.LTTP_ISSUE_SLIPS_READ,
      name: "Chứng từ quyết toán",
      description: "Truy cập hệ thống API chứng từ quyết toán.",
    },
  },
  {
    key: "templateFillRulesGet",
    method: "GET",
    module: CHUNG_TU_QUYET_TOAN_MODULE_NAME,
    path: "/template-fill-rules/:driveFileId",
    pathRoute: "/api/chungtuquyettoan/template-fill-rules/:driveFileId",
    permission: {
      code: PERMISSIONS.LTTP_ISSUE_SLIPS_READ,
      name: "Chứng từ quyết toán",
      description: "Truy cập hệ thống API chứng từ quyết toán.",
    },
  },
  {
    key: "templateFillRulesPut",
    method: "PUT",
    module: CHUNG_TU_QUYET_TOAN_MODULE_NAME,
    path: "/template-fill-rules/:driveFileId",
    pathRoute: "/api/chungtuquyettoan/template-fill-rules/:driveFileId",
    permission: {
      code: PERMISSIONS.LTTP_ISSUE_SLIPS_READ,
      name: "Chứng từ quyết toán",
      description: "Truy cập hệ thống API chứng từ quyết toán.",
    },
  },
  {
    key: "driveImport",
    method: "POST",
    module: CHUNG_TU_QUYET_TOAN_MODULE_NAME,
    path: "/drive-import",
    pathRoute: "/api/chungtuquyettoan/drive-import",
    permission: {
      code: PERMISSIONS.LTTP_ISSUE_SLIPS_READ,
      name: "Chứng từ quyết toán",
      description: "Truy cập hệ thống API chứng từ quyết toán.",
    },
  },
  {
    key: "templateCatalogList",
    method: "GET",
    module: CHUNG_TU_QUYET_TOAN_MODULE_NAME,
    path: "/template-catalog",
    pathRoute: "/api/chungtuquyettoan/template-catalog",
    permission: {
      code: PERMISSIONS.LTTP_ISSUE_SLIPS_READ,
      name: "Chứng từ quyết toán",
      description:
        "Xem danh mục mẫu chứng từ Drive (đã đăng ký — theo categoryKey): tên hiển thị và mở trên Google.",
    },
  },
];

export { CHUNG_TU_QUYET_TOAN_ROUTE_DEFINITIONS };
