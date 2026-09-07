import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardChungTuPdfTemplatesPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Mẫu chứng từ PDF",
  description: "Quản lý mẫu Excel PDF cho chứng từ quyết toán (Superadmin).",
});

export default function DashboardChungTuPdfTemplatesRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-chung-tu-pdf-templates">
      <DashboardChungTuPdfTemplatesPage />
    </RouteApiGuard>
  );
}
