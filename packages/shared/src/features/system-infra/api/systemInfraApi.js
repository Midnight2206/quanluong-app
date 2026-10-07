"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";

export function useSystemInfraQuery() {
  return useQuery({
    queryKey: qk.systemInfra.state(),
    queryFn: () => apiRequest({ url: "/system-infra", method: "get" }),
    refetchInterval: 30000,
  });
}
