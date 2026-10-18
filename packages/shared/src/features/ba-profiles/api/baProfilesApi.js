"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { useWrappedMutation } from "@/lib/useWrappedMutation";
import { apiRequest } from "@/services/apiRequest";

export function useBaLatestProfilesQuery(enabled = true) {
  return useQuery({
    queryKey: qk.baProfiles.latest(),
    queryFn: () => apiRequest({ url: "/ba/admin/unit-profiles", method: "get", skipTargetUnitHeader: true }),
    enabled,
  });
}

export function useBaProfileQuery(id) {
  return useQuery({
    queryKey: qk.baProfiles.detail(id),
    queryFn: () => apiRequest({ url: `/ba/admin/unit-profiles/${id}`, method: "get", skipTargetUnitHeader: true }),
    enabled: Boolean(id),
  });
}

export function useBaTokensQuery(enabled = true) {
  return useQuery({
    queryKey: qk.baProfiles.tokens(),
    queryFn: () => apiRequest({ url: "/ba/tokens", method: "get", skipTargetUnitHeader: true }),
    enabled,
  });
}

export function useCreateBaTokenMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/ba/tokens", method: "post", data: body, skipTargetUnitHeader: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.baProfiles.root }),
  });
}

export function useRevokeBaTokenMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (id) => apiRequest({ url: `/ba/tokens/${id}`, method: "delete", skipTargetUnitHeader: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.baProfiles.root }),
  });
}
