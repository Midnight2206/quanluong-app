/**
 * Tab dashboard cấp 1 dành cho superadmin (quản lý hệ thống).
 * Không trùng danh mục nghiệp vụ đơn vị — các đường dẫn `/dashboard/...` vẫn tồn tại;
 * superadmin có thể mở trực tiếp URL nếu cần (vd. bảng giá LTTP theo đơn vị).
 *
 * `routeAccessKey` khớp `ROUTE_ACCESS_REGISTRY` (probe 403 → ẩn).
 * Giao diện superadmin chạy trên app Next riêng (`apps/superadmin`, mặc định :3001).
 */
export const DASHBOARD_SUPERADMIN_TAB_META = [
  { path: "units", label: "Đơn vị (toàn hệ thống)", routeAccessKey: "dashboard-units" },
  { path: "users", label: "Người dùng", routeAccessKey: "dashboard-users" },
  {
    path: "pending-registrations",
    label: "Đăng ký chờ duyệt",
    routeAccessKey: "dashboard-pending",
  },
  {
    path: "lttp-groups",
    label: "Nhóm LTTP (toàn cục)",
    routeAccessKey: "dashboard-lttp-groups",
  },
  {
    path: "permission-matrix",
    label: "Ma trận quyền",
    routeAccessKey: "dashboard-permission-matrix",
  },
  {
    path: "permission-descriptions",
    label: "Mô tả quyền (chung)",
    routeAccessKey: "dashboard-permission-descriptions",
  },
  {
    path: "meal-allowance-rates",
    label: "Mức tiền ăn (Thông tư)",
    routeAccessKey: "dashboard-meal-allowance-rates",
  },
];
