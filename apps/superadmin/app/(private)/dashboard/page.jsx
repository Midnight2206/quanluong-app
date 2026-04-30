import { DashboardIndexRedirect } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Bảng điều khiển",
  description:
    "Điều hướng tới các mục quản trị đơn vị và hệ thống: đơn vị, người dùng, chức danh, LTTP, quyền.",
});

export default function DashboardIndexPage() {
  return <DashboardIndexRedirect />;
}
