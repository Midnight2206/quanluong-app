"use client";

import { useEffect } from "react";
import { useAuthInitialized, useCurrentUser, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { getMainAppOrigin } from "@/utils/superadminPortal";

export function SupplierOnlyRoute({ children }) {
  const initialized = useAuthInitialized();
  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();

  useEffect(() => {
    if (!initialized) {
      return;
    }
    if (!isAuthenticated) {
      window.location.replace(`${getMainAppOrigin()}/login`);
      return;
    }
    if (user?.type?.name !== "lttp_supplier") {
      window.location.replace(`${getMainAppOrigin()}/`);
    }
  }, [initialized, isAuthenticated, user]);

  if (!initialized) {
    return null;
  }

  if (!isAuthenticated) {
    return <p className="text-sm text-muted-foreground">Chuyển tới trang đăng nhập…</p>;
  }

  if (user?.type?.name !== "lttp_supplier") {
    return <p className="text-sm text-muted-foreground">Chuyển về ứng dụng chính…</p>;
  }

  return children;
}
