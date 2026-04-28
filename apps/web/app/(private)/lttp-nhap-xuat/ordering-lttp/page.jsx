import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { LttpNhapXuatPage } from "@/pages/lttpNhapXuat/LttpNhapXuatPage";

/** Cùng Shell tab Nhập xuất — segment ép tab Đặt hàng (`forcedActiveTabId`). */
export default function LttpOrderingRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-lttp-nhap-xuat">
      <LttpNhapXuatPage />
    </RouteApiGuard>
  );
}
