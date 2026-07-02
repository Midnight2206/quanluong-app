import { FileText, Home, LayoutDashboard, Soup, Users, Warehouse } from "lucide-react";
import { getMainAppOrigin, getSuperadminAppOrigin } from "@/utils/superadminPortal";

/**
 * Sidebar cho user nghiệp vụ / admin đơn vị.
 * `routeAccessKey` khớp `ROUTE_ACCESS_RULES` — ẩn khi thiếu quyền (theo phiên, không probe API).
 */
export const mainNavItems = [
  { to: "/", label: "Trang chủ", icon: Home },
  {
    to: "/dashboard/units",
    label: "Bảng điều khiển",
    icon: LayoutDashboard,
    /** Mọi route `/dashboard/...` vẫn tính là đang ở mục này (sáng tab sidebar). */
    activePathPrefix: "/dashboard",
  },
  {
    to: "/lttp-nhap-xuat",
    label: "Nhập xuất LTTP",
    icon: Warehouse,
    routeAccessKey: "nav-lttp-nhap-xuat",
  },
  {
    to: "/chungtuquyettoan",
    label: "Chứng từ quyết toán",
    icon: FileText,
    routeAccessKey: "nav-chungtuquyettoan",
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
    to: "/lttp-nhap-xuat",
    label: "Nhập xuất LTTP",
    icon: Warehouse,
    routeAccessKey: "nav-lttp-nhap-xuat",
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
  {
    to: "/dashboard/units",
    label: "Quản trị hệ thống",
    icon: LayoutDashboard,
    activePathPrefix: "/dashboard",
  },
  {
    to: "/lttp-nhap-xuat",
    label: "Nhập xuất LTTP",
    icon: Warehouse,
    routeAccessKey: "nav-lttp-nhap-xuat",
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
