import { Suspense } from "react";
import { LoginPage } from "@/pages/login/LoginPage";

export default function LoginRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <LoginPage />
    </Suspense>
  );
}
