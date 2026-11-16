"use client";

import { ClientRedirect } from "@/hocs/ClientRedirect";
import { useAuthInitialized, useCurrentUser, useIsAuthenticated } from "@/features/auth/model/authSlice";

export function SupplierOnlyRoute({ children }) {
  const initialized = useAuthInitialized();
  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();

  if (!initialized) {
    return null;
  }

  if (!isAuthenticated) {
    return <ClientRedirect href="/login?from=%2Fncc-dathang" replace />;
  }

  if (user?.type?.name !== "lttp_supplier") {
    return <ClientRedirect href="/dashboard" replace />;
  }

  return children;
}
