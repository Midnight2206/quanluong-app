import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { MealRosterPage } from "@/pages/meal-roster/MealRosterPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Chấm cơm",
  description:
    "Chấm cơm và danh sách bảo đảm quân lương theo tháng; dữ liệu theo phạm vi đơn vị của bạn.",
});

export default function MealRosterRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-meal-roster">
      <MealRosterPage />
    </RouteApiGuard>
  );
}
