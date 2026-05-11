import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { ChungTuQuyetToanPage } from "@/pages/chungTuQuyetToan/ChungTuQuyetToanPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Chứng từ quyết toán",
  description:
    "Chứng từ quyết toán — các tab loại chứng từ (bảng kê mua hàng, giấy đề nghị, phiếu thu chi…); bảng kê mua hàng soạn nháp và mở mẫu.",
});

export default function ChungTuQuyetToanRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-chungtuquyettoan">
      <ChungTuQuyetToanPage />
    </RouteApiGuard>
  );
}
