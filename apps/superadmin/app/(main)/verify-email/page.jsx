import { Suspense } from "react";
import { VerifyEmailPage } from "@/pages/verify-email/VerifyEmailPage";

export default function VerifyEmailRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <VerifyEmailPage />
    </Suspense>
  );
}
