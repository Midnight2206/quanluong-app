import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardMealAllowanceRatesPage } from "@/pages/dashboard/DashboardTabPages";

export default function DashboardMealAllowanceRatesRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-meal-allowance-rates">
      <DashboardMealAllowanceRatesPage />
    </RouteApiGuard>
  );
}
