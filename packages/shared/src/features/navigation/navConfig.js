import {
  BookOpen,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  Lock,
  Receipt,
  ScrollText,
  Users,
  Warehouse,
} from "lucide-react";
import { DASHBOARD_SUPERADMIN_TAB_META } from "@/pages/dashboard/superadminDashboardTabMeta";
import { getSuperadminAppOrigin } from "@/utils/superadminPortal";
import {
  SUPPLIER_DEFAULT_HOME,
  SUPPLIER_INVOICE_PATH,
  SUPPLIER_LEDGER_PATH,
  SUPPLIER_ORDER_PATH,
} from "@/utils/supplierPortal";

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
    requiresAuth: true,
    /** Mọi route `/dashboard/...` vẫn tính là đang ở mục này (sáng tab sidebar). */
    activePathPrefix: "/dashboard",
  },
  {
    to: "/lttp-nhap-xuat",
    label: "Nhập xuất LTTP",
    icon: Warehouse,
    requiresAuth: true,
    routeAccessKey: "nav-lttp-nhap-xuat",
  },
  {
    to: "/chungtuquyettoan",
    label: "Chứng từ quyết toán",
    icon: FileText,
    requiresAuth: true,
    routeAccessKey: "nav-chungtuquyettoan",
  },
  {
    to: "/users",
    label: "Người dùng",
    icon: Users,
    requiresAuth: true,
    routeAccessKey: "nav-users",
  },
  {
    to: "/so-sach-bep-an",
    label: "Sổ sách bếp ăn",
    icon: BookOpen,
    requiresAuth: true,
    routeAccessKey: "nav-kitchen-books",
  },
  {
    to: "/midnight-secret",
    label: "Báo cáo nội bộ",
    icon: Lock,
    requiresAuth: true,
    routeAccessKey: "nav-midnight-report",
  },
];

/**
 * Sidebar NCC — trang chủ gốc `/`; nghiệp vụ path phẳng `/ncc-*`.
 */
export const supplierNavItems = [
  { to: SUPPLIER_DEFAULT_HOME, label: "Trang chủ", icon: Home },
  {
    to: SUPPLIER_ORDER_PATH,
    label: "Đặt hàng",
    icon: ClipboardList,
    requiresAuth: true,
  },
  {
    to: SUPPLIER_LEDGER_PATH,
    label: "Sổ công nợ",
    icon: ScrollText,
    requiresAuth: true,
  },
  {
    to: SUPPLIER_INVOICE_PATH,
    label: "Hoá đơn hằng ngày",
    icon: Receipt,
    requiresAuth: true,
  },
];

/**
 * Sidebar superadmin trên app chính: «Quản trị hệ thống» mở cổng superadmin
 * (Next :3000→:3001, Docker :8080→:8081; prod quanluong.* → admin-quanluong.*;
 * hoặc NEXT_PUBLIC_SUPERADMIN_ORIGIN khi build — không bake origin lúc import module).
 */
export const superadminNavItems = [
  { to: "/", label: "Trang chủ", icon: Home },
  {
    to: "/dashboard",
    label: "Quản trị hệ thống",
    icon: LayoutDashboard,
    external: true,
    // Resolve lúc render/click — tránh localhost bake-in từ Docker build trên prod.
    resolveHref: () => `${getSuperadminAppOrigin()}/dashboard`,
  },
  {
    to: "/lttp-nhap-xuat",
    label: "Nhập xuất LTTP",
    icon: Warehouse,
    requiresAuth: true,
    routeAccessKey: "nav-lttp-nhap-xuat",
  },
  {
    to: "/users",
    label: "Người dùng",
    icon: Users,
    requiresAuth: true,
    routeAccessKey: "nav-users",
  },
  {
    to: "/so-sach-bep-an",
    label: "Sổ sách bếp ăn",
    icon: BookOpen,
    requiresAuth: true,
    routeAccessKey: "nav-kitchen-books",
  },
  {
    to: "/midnight-secret",
    label: "Báo cáo nội bộ",
    icon: Lock,
    requiresAuth: true,
    routeAccessKey: "nav-midnight-report",
  },
];

/**
 * Sidebar trên cổng superadmin: các mục dashboard quản trị hệ thống.
 */
export const superadminPortalNavItems = DASHBOARD_SUPERADMIN_TAB_META.map((t) => ({
  to: `/dashboard/${t.path}`,
  label: t.shortLabel,
  title: t.label,
  icon: t.icon,
  section: t.section,
  requiresAuth: true,
  routeAccessKey: t.routeAccessKey,
}));
