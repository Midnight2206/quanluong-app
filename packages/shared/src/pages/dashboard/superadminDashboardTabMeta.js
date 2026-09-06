import {
  BookOpen,
  Building2,
  FileText,
  Layers,
  Shield,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Tab dashboard cấp 1 dành cho superadmin (quản lý hệ thống).
 * Không trùng danh mục nghiệp vụ đơn vị — các đường dẫn `/dashboard/...` vẫn tồn tại;
 * superadmin có thể mở trực tiếp URL nếu cần (vd. bảng giá LTTP theo đơn vị).
 *
 * `routeAccessKey` khớp `ROUTE_ACCESS_REGISTRY` (probe 403 → ẩn).
 * Giao diện superadmin chạy trên app Next riêng (`apps/superadmin`, mặc định :3001).
 */
export const DASHBOARD_SUPERADMIN_TAB_META = [
  {
    path: "units",
    label: "Đơn vị (toàn hệ thống)",
    shortLabel: "Đơn vị",
    section: "Hệ thống",
    icon: Building2,
    routeAccessKey: "dashboard-units",
  },
  {
    path: "users",
    label: "Người dùng",
    shortLabel: "Người dùng",
    section: "Hệ thống",
    icon: Users,
    routeAccessKey: "dashboard-users",
  },
  {
    path: "pending-registrations",
    label: "Đăng ký chờ duyệt",
    shortLabel: "Đăng ký",
    section: "Hệ thống",
    icon: UserPlus,
    routeAccessKey: "dashboard-pending",
  },
  {
    path: "lttp-groups",
    label: "Nhóm LTTP (toàn cục)",
    shortLabel: "Nhóm LTTP",
    section: "Danh mục",
    icon: Layers,
    routeAccessKey: "dashboard-lttp-groups",
  },
  {
    path: "meal-allowance-rates",
    label: "Mức tiền ăn (Thông tư)",
    shortLabel: "Mức tiền ăn",
    section: "Danh mục",
    icon: Wallet,
    routeAccessKey: "dashboard-meal-allowance-rates",
  },
  {
    path: "permission-matrix",
    label: "Ma trận quyền",
    shortLabel: "Ma trận",
    section: "Quyền",
    icon: Shield,
    routeAccessKey: "dashboard-permission-matrix",
  },
  {
    path: "permission-descriptions",
    label: "Mô tả quyền (chung)",
    shortLabel: "Mô tả quyền",
    section: "Quyền",
    icon: BookOpen,
    routeAccessKey: "dashboard-permission-descriptions",
  },
  {
    path: "chung-tu-pdf-templates",
    label: "Mẫu chứng từ",
    shortLabel: "Mẫu CT",
    section: "Chứng từ",
    icon: FileText,
    routeAccessKey: "dashboard-chung-tu-pdf-templates",
  },
];
