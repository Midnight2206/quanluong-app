"use client";

import { Building2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  useAuthInitialized,
  useCurrentUser,
  useIsAuthenticated,
} from "@/features/auth/model/authSlice";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { isSuperadminUser } from "@/utils/postLoginPath";
import { getSuperadminAppOrigin } from "@/utils/superadminPortal";

export function PortalChooserPage() {
  const router = useRouter();
  const initialized = useAuthInitialized();
  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();

  if (!initialized) {
    return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  }
  if (!isAuthenticated) {
    return <ClientRedirect href="/login?from=%2Fchon-cong" replace />;
  }
  if (!isSuperadminUser(user)) {
    return <ClientRedirect href="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Chọn cổng làm việc</h1>
        <p className="text-sm text-muted-foreground">
          Tài khoản superadmin có thể vào ứng dụng đơn vị hoặc cổng quản trị hệ thống.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          className="h-11 w-full justify-start gap-2"
          onClick={() => router.replace("/")}
        >
          <Building2 className="size-4" aria-hidden />
          Làm việc
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full justify-start gap-2"
          onClick={() => {
            window.location.assign(`${getSuperadminAppOrigin()}/dashboard`);
          }}
        >
          <Shield className="size-4" aria-hidden />
          Quản trị
        </Button>
      </div>
    </div>
  );
}
