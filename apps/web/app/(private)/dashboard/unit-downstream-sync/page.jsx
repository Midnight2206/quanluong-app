import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardUnitDownstreamSyncPage } from "@/pages/dashboard/DashboardTabPages";

export default function DashboardUnitDownstreamSyncRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-unit-downstream-sync">
      <DashboardUnitDownstreamSyncPage />
    </RouteApiGuard>
  );
}
