"use client";

import { Building2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
  useIsAuthenticated,
  useAuthInitialized,
  useCurrentUser,
} from "@/features/auth/model/authSlice";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { supplierChooserHandoff } from "@/utils/postLoginPath";
import { getSupplierAppOrigin } from "@/utils/supplierPortal";
import { getSuperadminAppOrigin } from "@/utils/superadminPortal";

function ExternalRedirect({ href }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return null;
}

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
  const handoff = supplierChooserHandoff(user, getSupplierAppOrigin());
  if (handoff.external) {
    return <ExternalRedirect href={handoff.external} />;
  }
  if (handoff.internal) {
    return <ClientRedirect href={handoff.internal} replace />;
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
