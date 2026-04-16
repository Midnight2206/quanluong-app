import { Home, LayoutDashboard, Soup, Users } from "lucide-react";
import { getMainAppOrigin, getSuperadminAppOrigin } from "@/utils/superadminPortal";

/**
 * Sidebar cho user nghiệp vụ / admin đơn vị.
 * `routeAccessKey` khớp `ROUTE_ACCESS_RULES` — ẩn khi thiếu quyền (theo phiên, không probe API).
 */
export const mainNavItems = [
  { to: "/", label: "Trang chủ", icon: Home },
  { to: "/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard },
  {
    to: "/users",
    label: "Người dùng",
    icon: Users,
    routeAccessKey: "nav-users",
  },
  {
    to: "/meal-roster",
    label: "Chấm cơm",
    icon: Soup,
    routeAccessKey: "nav-meal-roster",
  },
];

/**
 * Sidebar superadmin trên app chính: «Quản trị hệ thống» mở cổng superadmin
 * (Next :3000→:3001, Docker :8080→:8081; hoặc NEXT_PUBLIC_SUPERADMIN_ORIGIN khi build).
 */
export const superadminNavItems = [
  { to: "/", label: "Trang chủ", icon: Home },
  {
    to: `${getSuperadminAppOrigin()}/dashboard`,
    label: "Quản trị hệ thống",
    icon: LayoutDashboard,
    external: true,
  },
  {
    to: "/users",
    label: "Người dùng",
    icon: Users,
    routeAccessKey: "nav-users",
  },
  {
    to: "/meal-roster",
    label: "Chấm cơm",
    icon: Soup,
    routeAccessKey: "nav-meal-roster",
  },
];

/**
 * Sidebar trên cổng superadmin: liên kết về app chính + dashboard nội bộ.
 */
export const superadminPortalNavItems = [
  { to: `${getMainAppOrigin()}/`, label: "Ứng dụng chính", icon: Home, external: true },
  { to: "/dashboard", label: "Quản trị hệ thống", icon: LayoutDashboard },
  {
    to: "/users",
    label: "Người dùng",
    icon: Users,
    routeAccessKey: "nav-users",
  },
  {
    to: "/meal-roster",
    label: "Chấm cơm",
    icon: Soup,
    routeAccessKey: "nav-meal-roster",
  },
];
