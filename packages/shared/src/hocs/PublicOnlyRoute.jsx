"use client";

import { ClientRedirect } from "@/hocs/ClientRedirect";
import { useAuthInitialized, useIsAuthenticated } from "@/features/auth/model/authSlice";

export function PublicOnlyRoute({ children }) {
  const isAuthenticated = useIsAuthenticated();
  const isInitialized = useAuthInitialized();

  if (!isInitialized) {
    return null;
  }

  if (isAuthenticated) {
    return <ClientRedirect href="/" replace />;
  }

  return children;
}
