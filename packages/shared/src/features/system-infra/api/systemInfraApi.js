"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { useWrappedMutation } from "@/lib/useWrappedMutation";
import { apiRequest } from "@/services/apiRequest";

export function useSystemInfraQuery() {
  return useQuery({
    queryKey: qk.systemInfra.state(),
    queryFn: () => apiRequest({ url: "/system-infra", method: "get" }),
    staleTime: 0,
    refetchInterval: 30000,
  });
}

export function useRestartContainerMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (name) =>
      apiRequest({
        url: `/system-infra/containers/${encodeURIComponent(name)}/restart`,
        method: "post",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.systemInfra.root }),
  });
}
