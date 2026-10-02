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

/** User thuộc đúng đơn vị kho, không gồm cấp dưới. */
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

export function useGetLttpWarehouseBuyerQuery(unitId, date, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.warehouseBuyer(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/lttp/warehouse-buyer",
        method: "get",
        params: { unitId, date },
      }),
    enabled: skip !== true && unitId != null && unitId !== "" && Boolean(date),
    staleTime: 30 * 1000,
    ...rest,
  });
}

export function useGetLttpAiAutoAcceptQuery(unitId, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.aiAutoAccept(unitId),
    queryFn: () =>
      apiRequest({ url: "/lttp/ai-auto-accept", method: "get", params: { unitId } }),
    enabled: skip !== true && unitId != null && unitId !== "",
    staleTime: 30 * 1000,
    ...rest,
  });
}

export function usePutLttpAiAutoAcceptMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/lttp/ai-auto-accept", method: "put", data: body }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.lttp.aiAutoAccept(variables?.unitId) });
    },
  });
}

export function usePutLttpWarehouseBuyerMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/lttp/warehouse-buyer", method: "put", data: body }),
    onSuccess: (_data, variables) => {
      invalidateLttpData(qc);
      qc.invalidateQueries({ queryKey: qk.lttp.buyerUsers(variables?.unitId) });
      qc.invalidateQueries({ queryKey: ["lttp", "warehouseBuyer"] });
      qc.invalidateQueries({ queryKey: ["lttp", "issueSlips"] });
    },
  });
}

/** ponytail: xoá hook này cùng nút «Gán cho mọi phiếu cũ» ở lần cập nhật tới. */
export function useRewriteLttpWarehouseBuyerMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/lttp/warehouse-buyer/rewrite-all", method: "post", data: body }),
    onSuccess: () => {
      invalidateLttpData(qc);
      qc.invalidateQueries({ queryKey: ["lttp", "issueSlips"] });
    },
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
