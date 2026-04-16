"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

export function useGetUnitLevelPermissionCapsMatrixQuery() {
  return useQuery({
    queryKey: qk.unitLevelCaps.matrix(),
    queryFn: () => apiRequest({ url: "/unit-level-permission-caps", method: "get" }),
  });
}

export function useReplaceUnitLevelPermissionCapsMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ depth, permissionIds }) =>
      apiRequest({
        url: `/unit-level-permission-caps/${depth}`,
        method: "put",
        data: { permissionIds },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.unitLevelCaps.matrix() }),
  });
}
