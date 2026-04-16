"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

export function useGetUnitsQuery(_arg, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.units.list(),
    queryFn: () => apiRequest({ url: "/units", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useGetUnitsScopeFlatQuery(_arg, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.units.scopeFlat(),
    queryFn: () =>
      apiRequest({ url: "/units", method: "get", skipTargetUnitHeader: true }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useGetPrivateDataSharesQuery(ownerUnitId, options = {}) {
  return useQuery({
    queryKey: qk.units.privateShares(ownerUnitId),
    queryFn: () =>
      apiRequest({
        url: "/units/private-data-shares",
        method: "get",
        params: { ownerUnitId },
      }),
    enabled: ownerUnitId != null && ownerUnitId !== "",
    ...options,
  });
}

export function useCreateUnitMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/units", method: "post", data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.units.root }),
  });
}

export function usePatchUnitMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, ...body }) =>
      apiRequest({ url: `/units/${id}`, method: "patch", data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.units.root }),
  });
}

export function useDeleteUnitMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (id) => apiRequest({ url: `/units/${id}`, method: "delete" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.units.root }),
  });
}

export function useCreatePrivateDataShareMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/units/private-data-shares", method: "post", data: body }),
    onSuccess: (_d, arg) => {
      qc.invalidateQueries({ queryKey: qk.units.privateShares(arg?.ownerUnitId) });
      qc.invalidateQueries({ queryKey: qk.units.root });
    },
  });
}

export function useRevokePrivateDataShareMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ grantId }) =>
      apiRequest({
        url: `/units/private-data-shares/${grantId}/revoke`,
        method: "patch",
      }),
    onSuccess: (_d, arg) => {
      qc.invalidateQueries({ queryKey: qk.units.privateShares(arg?.ownerUnitId) });
      qc.invalidateQueries({ queryKey: qk.units.root });
    },
  });
}
