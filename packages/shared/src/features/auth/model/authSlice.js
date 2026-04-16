"use client";

import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useAuthStore } from "@/features/auth/model/authStore";

const ALL_KNOWN_PERMISSION_CODES = Object.freeze(Object.values(PERMISSIONS));

export {
  clearAuthState,
  setAuthChecking,
  setAuthInitialized,
  setAuthState,
  useAuthStore,
} from "@/features/auth/model/authStore";

export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}

export function useAuthInitialized() {
  return useAuthStore((s) => s.initialized);
}

export function useIsAuthenticated() {
  return useAuthStore((s) => Boolean(s.user));
}

export function useAuthStatus() {
  return useAuthStore((s) => s.status);
}

export function usePermissions() {
  return useAuthStore((s) => s.permissions);
}

export function useEffectivePermissionCodes() {
  return useAuthStore((s) => {
    if (s.user?.type?.name === "superadmin") {
      return ALL_KNOWN_PERMISSION_CODES;
    }
    return s.permissions;
  });
}

export function useHasPermission(permissionCode) {
  return useAuthStore((s) => {
    const codes =
      s.user?.type?.name === "superadmin" ? ALL_KNOWN_PERMISSION_CODES : s.permissions;
    return codes.includes(permissionCode);
  });
}
