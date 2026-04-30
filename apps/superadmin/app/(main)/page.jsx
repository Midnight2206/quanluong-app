import { Suspense } from "react";
import { HomePage } from "@/pages/home/HomePage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Trang chủ",
  description:
    "Điểm vào cổng quản trị Quân lương và liên kết nhanh tới bảng điều khiển hệ thống.",
});

export default function HomeRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <HomePage />
    </Suspense>
  );
}
