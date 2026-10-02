import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardBackupPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Backup dữ liệu",
  description: "Chọn một bản backup theo ngày để khôi phục toàn bộ dữ liệu.",
});

export default function DashboardBackupRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-backup">
      <DashboardBackupPage />
    </RouteApiGuard>
  );
}
