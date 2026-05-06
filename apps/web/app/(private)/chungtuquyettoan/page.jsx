import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { ChungTuQuyetToanPage } from "@/pages/chungTuQuyetToan/ChungTuQuyetToanPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Chứng từ quyết toán",
  description: "Trang nghiệp vụ chứng từ quyết toán với hệ thống API riêng.",
});

export default function ChungTuQuyetToanRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-chungtuquyettoan">
      <ChungTuQuyetToanPage />
    </RouteApiGuard>
  );
}
