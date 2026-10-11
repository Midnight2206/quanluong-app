import { Suspense } from "react";
import { ZaloContinuePage } from "@/pages/login/ZaloContinuePage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Tiếp tục Zalo",
  description: "Xác minh số điện thoại Zalo và hoàn tất đăng nhập.",
});

export default function ZaloContinueRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <ZaloContinuePage />
    </Suspense>
  );
}
