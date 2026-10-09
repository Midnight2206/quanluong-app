import { PERMISSIONS } from "../../shared/constants/permissions.js";

const MODULE_NAME = "midnight";

const MIDNIGHT_ROUTE_DEFINITIONS = [
  {
    key: "listMidnightUnits",
    method: "GET",
    module: MODULE_NAME,
    path: "/units",
    pathRoute: "/api/midnight-secret/units",
    permission: {
      code: PERMISSIONS.MIDNIGHT_PRICES_READ,
      name: "Xem giá đối tác (báo cáo nội bộ)",
      description: "Xem đơn vị của mình trên báo cáo nội bộ.",
    },
  },
  {
    key: "getMidnightPartnerPrices",
    method: "GET",
    module: MODULE_NAME,
    path: "/partner-prices",
    pathRoute: "/api/midnight-secret/partner-prices",
    permission: {
      code: PERMISSIONS.MIDNIGHT_PRICES_READ,
      name: "Xem giá đối tác (báo cáo nội bộ)",
      description: "Xem bảng giá đối tác.",
    },
  },
  {
    key: "putMidnightPartnerPrices",
    method: "PUT",
    module: MODULE_NAME,
    path: "/partner-prices",
    pathRoute: "/api/midnight-secret/partner-prices",
    permission: {
      code: PERMISSIONS.MIDNIGHT_PRICES_WRITE,
      name: "Sửa giá đối tác (báo cáo nội bộ)",
      description: "Lưu bảng giá đối tác.",
    },
  },
  {
    key: "getMidnightMatrix",
    method: "GET",
    module: MODULE_NAME,
    path: "/lttp-partner-money-matrix",
    pathRoute: "/api/midnight-secret/lttp-partner-money-matrix",
    permission: {
      code: PERMISSIONS.MIDNIGHT_MATRIX_READ,
      name: "Xem báo cáo tiền theo ngày (nội bộ)",
      description: "Xem ma trận tiền theo ngày.",
    },
  },
  {
    key: "getMidnightPartnerTotals",
    method: "GET",
    module: MODULE_NAME,
    path: "/lttp-partner-totals",
    pathRoute: "/api/midnight-secret/lttp-partner-totals",
    permission: {
      code: PERMISSIONS.MIDNIGHT_MATRIX_READ,
      name: "Xem báo cáo tiền theo ngày (nội bộ)",
      description: "Xem tổng theo đối tác.",
    },
  },
  {
    key: "getMidnightSuppliers",
    method: "GET",
    module: MODULE_NAME,
    path: "/lttp-suppliers",
    pathRoute: "/api/midnight-secret/lttp-suppliers",
    permission: {
      code: PERMISSIONS.MIDNIGHT_MATRIX_READ,
      name: "Xem báo cáo tiền theo ngày (nội bộ)",
      description: "Xem đối tác trên báo cáo nội bộ.",
    },
  },
  {
    key: "getMidnightDebts",
    method: "GET",
    module: MODULE_NAME,
    path: "/partner-debts",
    pathRoute: "/api/midnight-secret/partner-debts",
    permission: {
      code: PERMISSIONS.MIDNIGHT_DEBTS_READ,
      name: "Xem công nợ đối tác (nội bộ)",
      description: "Xem công nợ đối tác.",
    },
  },
  {
    key: "listMidnightPayments",
    method: "GET",
    module: MODULE_NAME,
    path: "/partner-debts/:supplierId/payments",
    pathRoute: "/api/midnight-secret/partner-debts/:supplierId/payments",
    permission: {
      code: PERMISSIONS.MIDNIGHT_DEBTS_READ,
      name: "Xem công nợ đối tác (nội bộ)",
      description: "Xem lịch sử thanh toán.",
    },
  },
  {
    key: "createMidnightPayment",
    method: "POST",
    module: MODULE_NAME,
    path: "/partner-debts/:supplierId/payments",
    pathRoute: "/api/midnight-secret/partner-debts/:supplierId/payments",
    permission: {
      code: PERMISSIONS.MIDNIGHT_DEBTS_WRITE,
      name: "Ghi thanh toán công nợ đối tác (nội bộ)",
      description: "Ghi thanh toán công nợ.",
    },
  },
];

export { MIDNIGHT_ROUTE_DEFINITIONS };
