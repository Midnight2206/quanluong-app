import { create } from "zustand";

export const useAuthStore = create((set) => ({
  status: "unknown",
  user: null,
  setAuthLoading: () => set({ status: "loading" }),
  setAuthenticatedUser: (user) => set({ status: "authenticated", user }),
  clearAuth: () => set({ status: "unknown", user: null }),
  setUnauthenticated: () => set({ status: "unauthenticated", user: null }),
}));

export const selectAuthStatus = (s) => s.status;
export const selectCurrentUser = (s) => s.user;
