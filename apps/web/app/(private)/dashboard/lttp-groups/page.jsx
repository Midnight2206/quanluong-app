import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardLttpGroupsPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Nhóm LTTP (toàn cục)",
  description: "Danh mục nhóm lương thực thực phẩm dùng chung toàn hệ thống khi khai báo mặt hàng LTTP.",
});

export default function DashboardLttpGroupsRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-lttp-groups">
      <DashboardLttpGroupsPage />
    </RouteApiGuard>
  );
}
