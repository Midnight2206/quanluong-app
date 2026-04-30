import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardPendingRegistrationsPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Đăng ký chờ duyệt",
  description: "Xem và duyệt tài khoản đăng ký chờ xác nhận theo đơn vị.",
});

export default function DashboardPendingRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-pending">
      <DashboardPendingRegistrationsPage />
    </RouteApiGuard>
  );
}
