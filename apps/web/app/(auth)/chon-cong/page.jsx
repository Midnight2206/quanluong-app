import { Suspense } from "react";
import { PortalChooserPage } from "@/pages/portal/PortalChooserPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Chọn cổng",
  description: "Superadmin chọn vào ứng dụng chính hoặc cổng quản trị hệ thống.",
});

export default function PortalChooserRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <PortalChooserPage />
    </Suspense>
  );
}
