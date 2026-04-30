import { Suspense } from "react";
import { LoginPage } from "@/pages/login/LoginPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Đăng nhập (quản trị)",
  description: "Đăng nhập cổng Quân lương dành cho quản trị hệ thống và vận hành đơn vị.",
});

export default function LoginRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <LoginPage />
    </Suspense>
  );
}
