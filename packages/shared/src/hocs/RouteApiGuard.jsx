"use client";

import { ForbiddenPage } from "@/pages/forbidden/ForbiddenPage";
import { useRouteDecision } from "@/features/route-access/routeAccessHooks";

/**
 * Khi thiếu quyền theo `routeAccessKey` (so với phiên đăng nhập — không probe API).
 * @param {{ routeAccessKey?: string, children: import('react').ReactNode }} props
 */
export function RouteApiGuard({ routeAccessKey, children }) {
  const decision = useRouteDecision(routeAccessKey);
  if (routeAccessKey && decision === "forbidden") {
    return <ForbiddenPage />;
  }
  return children;
}
