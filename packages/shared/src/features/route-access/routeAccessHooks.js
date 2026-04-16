"use client";

import { useAuthStore } from "@/features/auth/model/authStore";

export function useRouteAccessByKey() {
  return useAuthStore((s) => s.routeAccessByKey);
}

export function useRouteDecision(routeAccessKey) {
  return useAuthStore((s) => {
    if (!routeAccessKey) {
      return "allowed";
    }
    return s.routeAccessByKey[routeAccessKey] === "forbidden" ? "forbidden" : "allowed";
  });
}

export function useIsRouteAllowed(routeAccessKey) {
  return useAuthStore((s) => s.routeAccessByKey[routeAccessKey] !== "forbidden");
}
