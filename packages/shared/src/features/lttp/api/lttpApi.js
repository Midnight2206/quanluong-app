"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest, withUnwrap } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

function invalidateLttpData(qc) {
  qc.invalidateQueries({ queryKey: qk.lttp.root });
}

export function useGetLttpFoodGroupsQuery(_arg, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.foodGroups(),
    queryFn: () => apiRequest({ url: "/lttp/food-groups", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useGetLttpFoodGroupsCatalogQuery(_arg, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.foodGroupsCatalog(),
    queryFn: () => apiRequest({ url: "/lttp/food-groups/catalog", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useGetLttpCommoditiesQuery(unitId, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.commodities(unitId),
    queryFn: () =>
      apiRequest({ url: "/lttp/commodities", method: "get", params: { unitId } }),
    enabled: skip !== true && unitId != null && unitId !== "",
    ...rest,
  });
}

export function useGetLttpEffectivePricesQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.effectivePrices(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/lttp/prices/effective",
        method: "get",
        params: { unitId, date },
      }),
    enabled: skip !== true && unitId != null && unitId !== "",
    ...rest,
  });
}

export function useLazyGetLttpEffectivePricesQuery() {
  const qc = useQueryClient();
  return [
    (arg) =>
      withUnwrap(
        qc.fetchQuery({
          queryKey: qk.lttp.effectivePrices(arg.unitId, arg.date),
          queryFn: () =>
            apiRequest({
              url: "/lttp/prices/effective",
              method: "get",
              params: { unitId: arg.unitId, date: arg.date },
            }),
        }),
      ),
    { isLoading: false },
  ];
}

export function useGetLttpPriceTablesQuery(arg, options = {}) {
  const { unitId, from, to } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.priceTables(unitId, from, to),
    queryFn: () =>
      apiRequest({
        url: "/lttp/price-tables",
        method: "get",
        params: { unitId, from, to },
      }),
    enabled: skip !== true && unitId != null && unitId !== "",
    ...rest,
  });
}

export function useGetLttpPriceTableDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: qk.lttp.priceTableDetail(id),
    queryFn: () => apiRequest({ url: `/lttp/price-tables/${id}`, method: "get" }),
    enabled: id != null && id !== "",
    ...options,
  });
}

export function useCreateLttpFoodGroupMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/lttp/food-groups", method: "post", data: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.lttp.foodGroups() });
      qc.invalidateQueries({ queryKey: qk.lttp.foodGroupsCatalog() });
    },
  });
}

export function usePatchLttpFoodGroupMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, body }) =>
      apiRequest({ url: `/lttp/food-groups/${id}`, method: "patch", data: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.lttp.foodGroups() });
      qc.invalidateQueries({ queryKey: qk.lttp.foodGroupsCatalog() });
    },
  });
}

export function useDeleteLttpFoodGroupMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (id) => apiRequest({ url: `/lttp/food-groups/${id}`, method: "delete" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.lttp.foodGroups() });
      qc.invalidateQueries({ queryKey: qk.lttp.foodGroupsCatalog() });
    },
  });
}

export function useCreateLttpCommodityMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/lttp/commodities", method: "post", data: body }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function usePatchLttpCommodityMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, body, unitId }) =>
      apiRequest({ url: `/lttp/commodities/${id}`, method: "patch", data: body }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function useDeleteLttpCommodityMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, unitId }) =>
      apiRequest({ url: `/lttp/commodities/${id}`, method: "delete" }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function useApplyLttpCommodityToUnitMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, targetUnitId, targetUnitIds, sourceUnitId }) =>
      apiRequest({
        url: `/lttp/commodities/${id}/apply-to-unit`,
        method: "post",
        data: targetUnitIds?.length ? { targetUnitIds } : { targetUnitId },
      }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function useCreateLttpPriceTableMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/lttp/price-tables", method: "post", data: body }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function usePatchLttpPriceTableMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, body, unitId }) =>
      apiRequest({ url: `/lttp/price-tables/${id}`, method: "patch", data: body }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function useDeleteLttpPriceTableMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, unitId }) =>
      apiRequest({ url: `/lttp/price-tables/${id}`, method: "delete" }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function useApplyLttpPriceTableToUnitMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, targetUnitId, targetUnitIds, targetEffectiveDate, sourceUnitId }) => {
      const base = targetUnitIds?.length ? { targetUnitIds } : { targetUnitId };
      const data =
        targetEffectiveDate != null && String(targetEffectiveDate).trim() !== ""
          ? { ...base, targetEffectiveDate: String(targetEffectiveDate).trim().slice(0, 10) }
          : base;
      return apiRequest({
        url: `/lttp/price-tables/${id}/apply-to-unit`,
        method: "post",
        data,
      });
    },
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function useImportLttpPriceTableMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ file, unitId, effectiveDate, note }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("unitId", String(unitId));
      fd.append("effectiveDate", effectiveDate);
      if (note) {
        fd.append("note", note);
      }
      return apiRequest({ url: "/lttp/price-tables/import", method: "post", data: fd });
    },
    onSuccess: () => invalidateLttpData(qc),
  });
}
