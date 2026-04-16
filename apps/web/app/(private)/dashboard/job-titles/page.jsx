import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardJobTitlesPage } from "@/pages/dashboard/DashboardTabPages";

export default function DashboardJobTitlesRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-job-titles">
      <DashboardJobTitlesPage />
    </RouteApiGuard>
  );
}
