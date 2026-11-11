import { Suspense } from "react";
import { MidnightLandingPage } from "@/pages/home/MidnightLandingPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Midnight",
  description:
    "Midnight — xây web app, website và firmware. Quân lương là sản phẩm vận hành quản lý quân nhu trên production.",
});

export default function HomeRoutePage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-muted-foreground">Đang tải…</p>}>
      <MidnightLandingPage />
    </Suspense>
  );
}
