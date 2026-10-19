import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardAuditLogsPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Nhật ký hệ thống",
  description: "Nhật ký đăng nhập, sử dụng và thay đổi dữ liệu.",
});

export default function DashboardAuditLogsRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-audit-logs">
      <DashboardAuditLogsPage />
    </RouteApiGuard>
  );
}
