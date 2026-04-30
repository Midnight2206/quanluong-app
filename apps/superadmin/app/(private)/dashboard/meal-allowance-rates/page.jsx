import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardMealAllowanceRatesPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Mức chấm cơm",
  description: "Cấu hình mức chế độ chấm cơm và bảo đảm quân lương theo tháng (theo đơn vị khi được gán quyền).",
});

export default function DashboardMealAllowanceRatesRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-meal-allowance-rates">
      <DashboardMealAllowanceRatesPage />
    </RouteApiGuard>
  );
}
