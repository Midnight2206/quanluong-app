import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardUsersPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Người dùng (bảng điều khiển)",
  description: "Danh sách người dùng nhúng trong dashboard; mở rộng toàn màn từ thẻ liên kết.",
});

export default function DashboardUsersRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-users">
      <DashboardUsersPage />
    </RouteApiGuard>
  );
}
