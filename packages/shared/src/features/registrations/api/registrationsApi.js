"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

export function useGetPendingRegistrationsQuery(_arg, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.registrations.pending(),
    queryFn: () => apiRequest({ url: "/registrations/pending", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useApproveRegistrationMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (userId) =>
      apiRequest({ url: `/registrations/${userId}/approve`, method: "post" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.registrations.root });
      qc.invalidateQueries({ queryKey: qk.users.root });
      qc.invalidateQueries({ queryKey: qk.jobTitles.root });
    },
  });
}

export function useRejectRegistrationMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ userId, note }) =>
      apiRequest({
        url: `/registrations/${userId}/reject`,
        method: "post",
        data: note != null && note !== "" ? { note } : {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.registrations.root });
      qc.invalidateQueries({ queryKey: qk.users.root });
      qc.invalidateQueries({ queryKey: qk.jobTitles.root });
    },
  });
}
