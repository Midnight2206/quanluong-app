import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardInfraPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Hạ tầng",
  description: "Đĩa máy chủ, backup đêm và container.",
});

export default function DashboardInfraRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-infra">
      <DashboardInfraPage />
    </RouteApiGuard>
  );
}
