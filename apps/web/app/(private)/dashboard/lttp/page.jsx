import { DashboardLttpIndexRedirect } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Bảng giá LTTP",
  description:
    "Điều hướng tới các tab nhóm, mặt hàng, đối tác, lịch sử bảng giá, giá theo ngày, cập nhật và nhập Excel LTTP.",
});

export default function DashboardLttpIndexPage() {
  return <DashboardLttpIndexRedirect />;
}
