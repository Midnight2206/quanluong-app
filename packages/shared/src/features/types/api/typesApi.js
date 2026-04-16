"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";

export function useGetTypesQuery() {
  return useQuery({
    queryKey: qk.types.list(),
    queryFn: () => apiRequest({ url: "/types", method: "get" }),
  });
}
