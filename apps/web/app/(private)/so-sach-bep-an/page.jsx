import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { KitchenBooksPage } from "@/pages/kitchen-books/KitchenBooksPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Sổ sách bếp ăn",
  description: "Danh mục món và thực đơn ngày theo buổi; tính số lượng LTTP từ quân số chấm cơm.",
});

export default function KitchenBooksRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-kitchen-books">
      <KitchenBooksPage />
    </RouteApiGuard>
  );
}
