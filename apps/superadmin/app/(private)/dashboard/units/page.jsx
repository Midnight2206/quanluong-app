import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardUnitsPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Đơn vị",
  description: "Quản trị đơn vị, cây nhánh và phân bổ dữ liệu theo phạm vi tài khoản.",
});

export default function DashboardUnitsRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-units">
      <DashboardUnitsPage />
    </RouteApiGuard>
  );
}
