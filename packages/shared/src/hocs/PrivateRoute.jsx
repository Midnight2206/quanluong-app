"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { useAuthInitialized, useIsAuthenticated } from "@/features/auth/model/authSlice";

export function PrivateRoute({ children }) {
  const isInitialized = useAuthInitialized();
  const isAuthenticated = useIsAuthenticated();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!isInitialized) {
    return null;
  }

  if (!isAuthenticated) {
    const q = searchParams.toString();
    const from = q ? `${pathname}?${q}` : pathname;
    const href = `/login?from=${encodeURIComponent(from)}`;
    return <ClientRedirect href={href} replace />;
  }

  return children;
}
