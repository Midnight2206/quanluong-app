"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";
import { invalidateLttpData } from "./lttpApiInvalidate.js";

/** Danh sách cấu hình người mua mặc định theo đơn vị kho (trong phạm vi quyền). */
export function useGetLttpBuyerDefaultsListQuery(options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.buyerDefaultsList(),
    queryFn: () => apiRequest({ url: "/lttp/buyer-default-users", method: "get" }),
    enabled: skip !== true,
    staleTime: 30 * 1000,
    ...rest,
  });
}

/** User có thể chọn làm người mua theo đơn vị kho (gồm nhánh cha/con LTTP). */
export function useGetLttpBuyerUsersQuery(unitId, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.buyerUsers(unitId),
    queryFn: () =>
      apiRequest({ url: "/lttp/buyer-users", method: "get", params: { unitId } }),
    enabled: skip !== true && unitId != null && unitId !== "",
    staleTime: 5 * 60 * 1000,
    ...rest,
  });
}

export function usePutLttpBuyerDefaultMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/lttp/buyer-default-user", method: "put", data: body }),
    onSuccess: (_data, variables) => {
      invalidateLttpData(qc);
      qc.invalidateQueries({ queryKey: qk.lttp.buyerDefaultsList() });
      if (variables?.unitId != null) {
        qc.invalidateQueries({ queryKey: qk.lttp.issueFormDefaults(variables.unitId) });
        qc.invalidateQueries({ queryKey: ["lttp", "issueSlips"] });
      }
    },
  });
}
