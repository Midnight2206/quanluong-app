import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardUnitsPage } from "@/pages/dashboard/DashboardTabPages";

export default function DashboardUnitsRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-units">
      <DashboardUnitsPage />
    </RouteApiGuard>
  );
}
