import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardBaProfilesPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Hồ sơ nghiệp vụ",
  description: "Hồ sơ nghiệp vụ đơn vị do trợ lý BA đẩy lên.",
});

export default function DashboardBaProfilesRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-ba-profiles">
      <DashboardBaProfilesPage />
    </RouteApiGuard>
  );
}
