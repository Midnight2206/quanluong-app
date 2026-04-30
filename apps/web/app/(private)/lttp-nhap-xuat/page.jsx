import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { LttpNhapXuatPage } from "@/pages/lttpNhapXuat/LttpNhapXuatPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Nhập xuất LTTP",
  description:
    "Phiếu xuất, lịch sử phiếu, lập phiếu mới và tổng hợp đặt hàng lương thực thực phẩm trong đơn vị được gán.",
});

export default function LttpNhapXuatRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-lttp-nhap-xuat">
      <LttpNhapXuatPage />
    </RouteApiGuard>
  );
}
