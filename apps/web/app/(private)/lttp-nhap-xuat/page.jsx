import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { LttpNhapXuatPage } from "@/pages/lttpNhapXuat/LttpNhapXuatPage";

export default function LttpNhapXuatRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-lttp-nhap-xuat">
      <LttpNhapXuatPage />
    </RouteApiGuard>
  );
}
