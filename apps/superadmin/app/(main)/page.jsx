import { Suspense } from "react";
import { HomePage } from "@/pages/home/HomePage";

export default function HomeRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <HomePage />
    </Suspense>
  );
}
