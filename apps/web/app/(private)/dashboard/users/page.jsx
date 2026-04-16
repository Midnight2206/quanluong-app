import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardUsersPage } from "@/pages/dashboard/DashboardTabPages";

export default function DashboardUsersRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-users">
      <DashboardUsersPage />
    </RouteApiGuard>
  );
}
