import { Suspense } from "react";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";

export default function ResetPasswordRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <ResetPasswordPage />
    </Suspense>
  );
}
