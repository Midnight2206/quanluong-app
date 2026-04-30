import { Suspense } from "react";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Đặt lại mật khẩu",
  description: "Tạo mật khẩu mới từ liên kết đã được gửi trong email của bạn.",
});

export default function ResetPasswordRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <ResetPasswordPage />
    </Suspense>
  );
}
