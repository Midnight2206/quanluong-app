import { DashboardPermissionDescriptionsRoute } from "@/pages/dashboard/DashboardPermissionDescriptionsRoute";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Mô tả quyền",
  description: "Xem và chỉnh mô tả tiếng Việt cho từng mã quyền API phục vụ rà soát phân quyền.",
});

export default function DashboardPermissionDescriptionsRoutePage() {
  return <DashboardPermissionDescriptionsRoute />;
}
