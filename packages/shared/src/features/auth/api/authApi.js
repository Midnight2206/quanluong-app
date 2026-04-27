"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, withUnwrap } from "@/services/apiRequest";
import { qk } from "@/app/query/queryKeys";
import { mapPermissionsFromUser, useAuthStore } from "@/features/auth/model/authStore";
import { clearTargetUnitId } from "@/services/targetUnitScope";

async function fetchCurrentUser() {
  try {
    const data = await apiRequest({ url: "/auth/current-user", method: "get" });
    useAuthStore.getState().setAuthState({ user: data, permissions: mapPermissionsFromUser(data) });
    return data;
  } catch {
    clearTargetUnitId();
    useAuthStore.getState().clearAuthState();
    throw new Error("unauthenticated");
  }
}

export function useGetCurrentUserQuery(options = {}) {
  return useQuery({
    queryKey: qk.auth.currentUser(),
    queryFn: fetchCurrentUser,
    retry: false,
    ...options,
  });
}

export function useGetRegisterUnitsQuery(_arg, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.auth.registerUnits(),
    queryFn: () => apiRequest({ url: "/auth/register-units", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useLazyGetAvatarJobQuery() {
  const qc = useQueryClient();
  return [
    (jobId) =>
      withUnwrap(
        qc.fetchQuery({
          queryKey: qk.auth.avatarJob(jobId),
          queryFn: () =>
            apiRequest({ url: `/auth/me/avatar-job/${jobId}`, method: "get" }),
        }),
      ),
    { isLoading: false },
  ];
}

export function useLazyGetCurrentUserQuery() {
  const qc = useQueryClient();
  return [
    () =>
      withUnwrap(
        qc.fetchQuery({
          queryKey: qk.auth.currentUser(),
          queryFn: fetchCurrentUser,
        }),
      ),
    { isLoading: false },
  ];
}

function useAuthMutation(mutationOptions) {
  const m = useMutation(mutationOptions);
  const trigger = (arg) => withUnwrap(m.mutateAsync(arg));
  return [trigger, { isLoading: m.isPending, ...m }];
}

export function useLoginMutation() {
  const qc = useQueryClient();
  return useAuthMutation({
    mutationFn: (payload) => apiRequest({ url: "/auth/login", method: "post", data: payload }),
    onSuccess: (data) => {
      clearTargetUnitId();
      useAuthStore.getState().setAuthState({ user: data, permissions: mapPermissionsFromUser(data) });
      qc.invalidateQueries({ queryKey: qk.auth.root });
    },
  });
}

export function useRegisterMutation() {
  const qc = useQueryClient();
  return useAuthMutation({
    mutationFn: (payload) => apiRequest({ url: "/auth/register", method: "post", data: payload }),
    onSuccess: (data) => {
      if (data?.pending || data?.needsVerification) {
        return;
      }
      clearTargetUnitId();
      useAuthStore.getState().setAuthState({ user: data, permissions: mapPermissionsFromUser(data) });
      qc.invalidateQueries({ queryKey: qk.auth.root });
    },
  });
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useAuthMutation({
    mutationFn: () => apiRequest({ url: "/auth/logout", method: "post" }),
    onSettled: () => {
      clearTargetUnitId();
      useAuthStore.getState().clearAuthState();
      qc.clear();
    },
  });
}

export function useRequestVerificationEmailMutation() {
  return useAuthMutation({
    mutationFn: () => apiRequest({ url: "/auth/request-verification-email", method: "post" }),
  });
}

export function useRequestVerificationEmailPublicMutation() {
  return useAuthMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/auth/request-verification-email/public", method: "post", data: body }),
  });
}

export function useForgotPasswordMutation() {
  return useAuthMutation({
    mutationFn: (body) => apiRequest({ url: "/auth/forgot-password", method: "post", data: body }),
  });
}

export function useResetPasswordMutation() {
  return useAuthMutation({
    mutationFn: (body) => apiRequest({ url: "/auth/reset-password", method: "post", data: body }),
  });
}

export function useChangePasswordMutation() {
  return useAuthMutation({
    mutationFn: (body) => apiRequest({ url: "/auth/change-password", method: "post", data: body }),
  });
}

export function usePatchMeProfileMutation() {
  const qc = useQueryClient();
  return useAuthMutation({
    mutationFn: (body) => apiRequest({ url: "/auth/me/profile", method: "patch", data: body }),
    onSuccess: (data) => {
      if (data?.id != null) {
        useAuthStore.getState().setAuthState({ user: data, permissions: mapPermissionsFromUser(data) });
      }
      qc.invalidateQueries({ queryKey: qk.auth.currentUser() });
    },
  });
}

export function useDeleteAvatarMutation() {
  const qc = useQueryClient();
  return useAuthMutation({
    mutationFn: () => apiRequest({ url: "/auth/me/avatar", method: "delete" }),
    onSuccess: (data) => {
      if (data?.id != null) {
        useAuthStore.getState().setAuthState({ user: data, permissions: mapPermissionsFromUser(data) });
      }
      qc.invalidateQueries({ queryKey: qk.auth.currentUser() });
    },
  });
}

export function useUnlinkGoogleDriveMutation() {
  const qc = useQueryClient();
  return useAuthMutation({
    mutationFn: () => apiRequest({ url: "/auth/google/drive", method: "delete" }),
    onSuccess: (data) => {
      if (data?.id != null) {
        useAuthStore.getState().setAuthState({ user: data, permissions: mapPermissionsFromUser(data) });
      }
      qc.invalidateQueries({ queryKey: qk.auth.currentUser() });
    },
  });
}

export function useCheckGoogleDriveLinkMutation() {
  const qc = useQueryClient();
  return useAuthMutation({
    mutationFn: () => apiRequest({ url: "/auth/google/drive/status", method: "get" }),
    onSuccess: (data) => {
      if (data?.id != null) {
        useAuthStore.getState().setAuthState({ user: data, permissions: mapPermissionsFromUser(data) });
      }
      qc.invalidateQueries({ queryKey: qk.auth.currentUser() });
    },
  });
}

export function useUploadAvatarMutation() {
  const qc = useQueryClient();
  return useAuthMutation({
    mutationFn: ({ file, crop }) => {
      const body = new FormData();
      body.append("avatar", file);
      if (crop) {
        body.append("crop", JSON.stringify(crop));
      }
      return apiRequest({ url: "/auth/me/avatar", method: "post", data: body });
    },
    onSuccess: (data) => {
      if (data?.id != null) {
        useAuthStore.getState().setAuthState({ user: data, permissions: mapPermissionsFromUser(data) });
      }
      qc.invalidateQueries({ queryKey: qk.auth.currentUser() });
    },
  });
}
