"use client";

import { ClientRedirect } from "@/hocs/ClientRedirect";
import { useAuthInitialized, useCurrentUser, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { publicOnlyRedirectPath } from "@/utils/postLoginPath";

export function PublicOnlyRoute({ children }) {
  const isAuthenticated = useIsAuthenticated();
  const isInitialized = useAuthInitialized();
  const user = useCurrentUser();

  if (!isInitialized) {
    return null;
  }

  if (isAuthenticated) {
    const loc = typeof window !== "undefined" ? window.location : null;
    return <ClientRedirect href={publicOnlyRedirectPath(user, loc)} replace />;
  }

  return children;
}
