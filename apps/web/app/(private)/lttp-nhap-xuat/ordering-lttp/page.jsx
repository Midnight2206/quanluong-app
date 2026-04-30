import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { LttpNhapXuatPage } from "@/pages/lttpNhapXuat/LttpNhapXuatPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Đặt hàng LTTP",
  description:
    "Bảng tổng hợp đặt hàng theo phiếu xuất trong ngày, lọc đối tác và xuất ảnh hoặc in.",
});

/** Cùng Shell tab Nhập xuất — segment ép tab Đặt hàng (`forcedActiveTabId`). */
export default function LttpOrderingRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-lttp-nhap-xuat">
      <LttpNhapXuatPage />
    </RouteApiGuard>
  );
}
