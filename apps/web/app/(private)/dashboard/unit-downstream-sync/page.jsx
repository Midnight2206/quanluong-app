import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardUnitDownstreamSyncPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Đồng bộ đơn vị con",
  description:
    "Cấu hình chia sẻ dữ liệu xuống đơn vị con theo chiều downstream trong phân cấp đơn vị.",
});

export default function DashboardUnitDownstreamSyncRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-unit-downstream-sync">
      <DashboardUnitDownstreamSyncPage />
    </RouteApiGuard>
  );
}
