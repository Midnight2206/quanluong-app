import { Suspense } from "react";
import { LoginPage } from "@/pages/login/LoginPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Đăng nhập",
  description: "Đăng nhập Quân lương bằng tài khoản của bạn (phiên đăng nhập an toàn với cookie HTTP-only).",
});

export default function LoginRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <LoginPage />
    </Suspense>
  );
}
