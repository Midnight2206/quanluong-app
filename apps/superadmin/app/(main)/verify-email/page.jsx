import { Suspense } from "react";
import { VerifyEmailPage } from "@/pages/verify-email/VerifyEmailPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Xác minh email",
  description: "Kích hoạt địa chỉ email của tài khoản Quân lương từ token trên đường link.",
});

export default function VerifyEmailRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <VerifyEmailPage />
    </Suspense>
  );
}
