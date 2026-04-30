import { Suspense } from "react";
import { HomePage } from "@/pages/home/HomePage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Trang chủ",
  description:
    "Điểm vào cổng Quân lương: bảng điều khiển đơn vị, nhập xuất LTTP, người dùng và chấm cơm theo phân quyền.",
});

export default function HomeRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <HomePage />
    </Suspense>
  );
}
