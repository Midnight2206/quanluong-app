/**
 * Quy tắc hiển thị route/menu: so khớp với quyền đã có trong phiên (không gọi API probe).
 * `requiredPermissions`: cần **ít nhất một** mã quyền; rỗng = mọi user đã đăng nhập đều thấy.
 * Superadmin được coi như có toàn bộ quyền (xử lý trong slice).
 */
import { PERMISSIONS } from "@/features/permissions/constants/permissions";

/** @type {Record<string, { description?: string, requiredPermissions: string[] }>} */
export const ROUTE_ACCESS_RULES = {
  "nav-users": {
    description: "Trang /users",
    requiredPermissions: [PERMISSIONS.USERS_READ],
  },
  "dashboard-overview": {
    description: "Tổng quan",
    requiredPermissions: [],
  },
  "dashboard-my-permissions": {
    description: "Quyền của tôi",
    requiredPermissions: [],
  },
  "dashboard-units": {
    description: "Đơn vị",
    requiredPermissions: [PERMISSIONS.UNITS_READ],
  },
  "dashboard-users": {
    description: "Người dùng (dashboard)",
    requiredPermissions: [PERMISSIONS.USERS_READ],
  },
  "dashboard-pending": {
    description: "Đăng ký chờ duyệt",
    requiredPermissions: [PERMISSIONS.REGISTRATIONS_READ],
  },
  "dashboard-job-titles": {
    description: "Chức danh",
    requiredPermissions: [PERMISSIONS.JOB_TITLES_READ],
  },
  "dashboard-unit-downstream-sync": {
    description: "Đồng bộ đơn vị con",
    requiredPermissions: [],
  },
  "dashboard-lttp": {
    description: "LTTP — nhóm route",
    requiredPermissions: [PERMISSIONS.LTTP_GROUPS_READ],
  },
  "dashboard-lttp-food-groups": {
    description: "LTTP — nhóm",
    requiredPermissions: [PERMISSIONS.LTTP_GROUPS_READ],
  },
  "dashboard-lttp-commodities": {
    description: "LTTP — mặt hàng",
    requiredPermissions: [PERMISSIONS.LTTP_COMMODITIES_READ],
  },
  "dashboard-lttp-suppliers": {
    description: "LTTP — đối tác cung cấp",
    requiredPermissions: [PERMISSIONS.LTTP_COMMODITIES_READ],
  },
  "dashboard-lttp-price-tables": {
    description: "LTTP — bảng giá",
    requiredPermissions: [PERMISSIONS.LTTP_PRICES_READ],
  },
  "dashboard-lttp-effective": {
    description: "LTTP — giá theo ngày",
    requiredPermissions: [PERMISSIONS.LTTP_PRICES_READ],
  },
  "nav-lttp-nhap-xuat": {
    description: "Trang Nhập xuất LTTP — phiếu xuất, in theo mẫu",
    requiredPermissions: [PERMISSIONS.LTTP_ISSUE_SLIPS_READ],
  },
  "dashboard-lttp-groups": {
    description: "Nhóm LTTP toàn cục",
    requiredPermissions: [PERMISSIONS.LTTP_GROUPS_READ],
  },
  "dashboard-reports": {
    description: "Báo cáo (placeholder)",
    requiredPermissions: [],
  },
  "dashboard-analytics": {
    description: "Thống kê (placeholder)",
    requiredPermissions: [],
  },
  "dashboard-permission-matrix": {
    description: "Ma trận quyền",
    requiredPermissions: [PERMISSIONS.UNIT_LEVEL_CAPS_READ],
  },
  "dashboard-permission-descriptions": {
    description: "Mô tả quyền",
    requiredPermissions: [PERMISSIONS.PERMISSIONS_READ],
  },
  "dashboard-settings": {
    description: "Cấu hình (placeholder)",
    requiredPermissions: [],
  },
  "dashboard-meal-allowance-rates": {
    description: "Mức tiền ăn (Thông tư 96) — danh mục công khai",
    requiredPermissions: [],
  },
  "nav-meal-roster": {
    description: "Trang Chấm cơm / danh sách bảo đảm quân lương",
    requiredPermissions: [PERMISSIONS.MEAL_ROSTER_ACCESS],
  },
};

export const ROUTE_ACCESS_KEYS = Object.freeze(Object.keys(ROUTE_ACCESS_RULES));

/** Map `lttpSub` (URL) → khóa registry cho RouteApiGuard */
export const DASHBOARD_LTTP_SUB_ACCESS_KEY = Object.freeze({
  "food-groups": "dashboard-lttp-food-groups",
  commodities: "dashboard-lttp-commodities",
  suppliers: "dashboard-lttp-suppliers",
  tables: "dashboard-lttp-price-tables",
  effective: "dashboard-lttp-effective",
  newtable: "dashboard-lttp-price-tables",
  import: "dashboard-lttp-price-tables",
});
