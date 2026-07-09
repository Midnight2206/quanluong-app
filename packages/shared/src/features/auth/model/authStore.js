import { create } from "zustand";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { ROUTE_ACCESS_RULES } from "@/features/route-access/routeAccessRegistry";

const ALL_KNOWN_PERMISSION_CODES = Object.freeze(Object.values(PERMISSIONS));
const ALL_PERMISSION_CODES = new Set(Object.values(PERMISSIONS));

export function mapPermissionsFromUser(user) {
  return user?.permissions?.map((permission) => permission.code) || [];
}

function buildRouteAccessByKey(user, permissionCodes) {
  const isSuperadmin = user?.type?.name === "superadmin";
  const codes = new Set(isSuperadmin ? ALL_PERMISSION_CODES : permissionCodes || []);

  /** @type {Record<string, 'allowed' | 'forbidden'>} */
  const byKey = {};
  for (const [key, def] of Object.entries(ROUTE_ACCESS_RULES)) {
    const required = def.requiredPermissions || [];
    if (!required.length || isSuperadmin) {
      byKey[key] = "allowed";
    } else {
      byKey[key] = required.some((c) => codes.has(c)) ? "allowed" : "forbidden";
    }
  }
  return byKey;
}

export const useAuthStore = create((set, get) => ({
  user: null,
  permissions: [],
  status: "checking",
  initialized: false,
  /** @type {Record<string, 'allowed' | 'forbidden'>} */
  routeAccessByKey: buildRouteAccessByKey(null, []),

  setAuthChecking: () => set({ status: "checking" }),

  /** @param {{ user: unknown, permissions?: string[] }} payload */
  setAuthState: (payload) => {
    const user = payload?.user;
    const permissions = payload?.permissions ?? mapPermissionsFromUser(user);
    set({
      user,
      permissions,
      status: "authenticated",
      initialized: true,
      routeAccessByKey: buildRouteAccessByKey(user, permissions),
    });
  },

  clearAuthState: () =>
    set({
      user: null,
      permissions: [],
      status: "anonymous",
      initialized: true,
      routeAccessByKey: buildRouteAccessByKey(null, []),
    }),

  setAuthInitialized: () => {
    const s = get();
    set({
      initialized: true,
      status: s.user ? "authenticated" : "anonymous",
    });
  },
}));

/** Gọi ngoài React (middleware auth API). */
export function getAuthState() {
  return useAuthStore.getState();
}

export function setAuthChecking() {
  useAuthStore.getState().setAuthChecking();
}
export function setAuthInitialized() {
  useAuthStore.getState().setAuthInitialized();
}
export function setAuthState(payload) {
  useAuthStore.getState().setAuthState(payload);
}
export function clearAuthState() {
  useAuthStore.getState().clearAuthState();
}
