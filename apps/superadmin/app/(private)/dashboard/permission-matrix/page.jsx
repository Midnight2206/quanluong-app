import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardPermissionMatrixPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Ma trận quyền",
  description: "Gán quyền API theo nhóm loại tài khoản và theo module chức năng.",
});

export default function DashboardPermissionMatrixRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-permission-matrix">
      <DashboardPermissionMatrixPage />
    </RouteApiGuard>
  );
}
