import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardJobTitlesPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Chức danh & phân quyền",
  description: "Chức danh đơn vị, chỉ định quyền theo chức danh và chỉ định theo nhóm quyền.",
});

export default function DashboardJobTitlesRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-job-titles">
      <DashboardJobTitlesPage />
    </RouteApiGuard>
  );
}
