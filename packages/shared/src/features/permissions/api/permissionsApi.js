"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

export function useGetPermissionsCatalogQuery() {
  return useQuery({
    queryKey: qk.permissions.catalog(),
    queryFn: () => apiRequest({ url: "/permissions", method: "get" }),
  });
}

export function usePatchPermissionDescriptionMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, description }) =>
      apiRequest({ url: `/permissions/${id}`, method: "patch", data: { description } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.permissions.catalog() }),
  });
}
