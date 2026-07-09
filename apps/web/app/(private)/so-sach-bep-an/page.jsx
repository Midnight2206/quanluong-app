import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { KitchenBooksPage } from "@/pages/kitchen-books/KitchenBooksPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Sổ sách bếp ăn",
  description:
    "Chấm cơm, danh sách bảo đảm quân lương và danh mục món bếp ăn theo phạm vi đơn vị.",
});

export default function KitchenBooksRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-kitchen-books">
      <KitchenBooksPage />
    </RouteApiGuard>
  );
}
