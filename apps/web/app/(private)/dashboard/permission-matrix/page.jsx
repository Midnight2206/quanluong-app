import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardPermissionMatrixPage } from "@/pages/dashboard/DashboardTabPages";

export default function DashboardPermissionMatrixRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-permission-matrix">
      <DashboardPermissionMatrixPage />
    </RouteApiGuard>
  );
}
