/** Các đoạn con hợp lệ trong `/dashboard/lttp/:lttpSub` (khớp AdminLttpPanel). */
export const DASHBOARD_LTTP_SUB_PATHS = [
  "food-groups",
  "commodities",
  "suppliers",
  "tables",
  "effective",
  "newtable",
  "import",
];

/**
 * Tab dashboard cấp 1 cho admin / user nghiệp vụ (theo đơn vị & vận hành).
 * Superadmin dùng `DASHBOARD_SUPERADMIN_TAB_META` trong `superadminDashboardTabMeta.js`.
 *
 * `routeAccessKey` trùng `ROUTE_ACCESS_REGISTRY` (probe 403 → ẩn).
 */
export const DASHBOARD_TAB_META = [
  { path: "units", label: "Đơn vị", routeAccessKey: "dashboard-units" },
  { path: "users", label: "Người dùng", routeAccessKey: "dashboard-users" },
  {
    path: "pending-registrations",
    label: "Đăng ký chờ duyệt",
    routeAccessKey: "dashboard-pending",
  },
  {
    path: "job-titles",
    label: "Chức danh & phân quyền",
    routeAccessKey: "dashboard-job-titles",
  },
  {
    path: "unit-downstream-sync",
    label: "Đồng bộ đơn vị con",
    routeAccessKey: "dashboard-unit-downstream-sync",
  },
  {
    path: "lttp",
    label: "Bảng giá LTTP",
    nestedUnder: "lttp",
    routeAccessKey: "dashboard-lttp",
  },
];
