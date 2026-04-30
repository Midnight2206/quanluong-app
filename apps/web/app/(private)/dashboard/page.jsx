import { DashboardIndexRedirect } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Bảng điều khiển",
  description:
    "Điều hướng tới các mục quản trị đơn vị: đơn vị, người dùng, đăng ký chờ duyệt, chức danh và bảng giá LTTP.",
});

export default function DashboardIndexPage() {
  return <DashboardIndexRedirect />;
}
