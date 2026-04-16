import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardPendingRegistrationsPage } from "@/pages/dashboard/DashboardTabPages";

export default function DashboardPendingRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-pending">
      <DashboardPendingRegistrationsPage />
    </RouteApiGuard>
  );
}
