import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardLttpGroupsPage } from "@/pages/dashboard/DashboardTabPages";

export default function DashboardLttpGroupsRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-lttp-groups">
      <DashboardLttpGroupsPage />
    </RouteApiGuard>
  );
}
