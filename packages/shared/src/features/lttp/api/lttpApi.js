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

export function useGetLttpSuppliersQuery(unitId, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.suppliers(unitId),
    queryFn: () => apiRequest({ url: "/lttp/suppliers", method: "get", params: { unitId } }),
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

export function useCreateLttpSupplierMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/lttp/suppliers", method: "post", data: body }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function usePatchLttpSupplierMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, body }) =>
      apiRequest({ url: `/lttp/suppliers/${id}`, method: "patch", data: body }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function useDeleteLttpSupplierMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id }) => apiRequest({ url: `/lttp/suppliers/${id}`, method: "delete" }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function usePutLttpCommodityDefaultSupplierMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, lttpSupplierId }) =>
      apiRequest({
        url: `/lttp/commodities/${id}/default-lttp-supplier`,
        method: "put",
        data: { lttpSupplierId },
      }),
    onSuccess: () => {
      invalidateLttpData(qc);
    },
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

export function useGetLttpIssueFormDefaultsQuery(unitId, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.issueFormDefaults(unitId),
    queryFn: () =>
      apiRequest({ url: "/lttp/issue-form-defaults", method: "get", params: { unitId } }),
    enabled: skip !== true && unitId != null && unitId !== "",
    ...rest,
  });
}

export function usePutLttpIssueFormDefaultsMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/lttp/issue-form-defaults", method: "put", data: body }),
    onSuccess: () => {
      invalidateLttpData(qc);
    },
  });
}

export function useGetLttpNextIssueSlipSerialQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.nextIssueSlipSerial(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/lttp/issue-slips/next-serial",
        method: "get",
        params: { unitId, date },
      }),
    enabled: Boolean(
      skip !== true && unitId != null && unitId !== "" && date && String(date).trim() !== "",
    ),
    ...rest,
  });
}

export function useGetLttpRecipientUsersQuery(recipientUnitId, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.recipientUsers(recipientUnitId),
    queryFn: () =>
      apiRequest({ url: "/lttp/recipient-users", method: "get", params: { unitId: recipientUnitId } }),
    enabled: skip !== true && recipientUnitId != null && recipientUnitId !== "",
    ...rest,
  });
}

/** User mặc định theo **đơn vị nhận** (bảng riêng, không theo kho cấp). */
export function useGetLttpReceivingDefaultRecipientQuery(recipientUnitId, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.receivingDefaultRecipient(recipientUnitId),
    queryFn: () =>
      apiRequest({
        url: "/lttp/receiving-default-recipient",
        method: "get",
        params: { recipientUnitId },
      }),
    enabled: skip !== true && recipientUnitId != null && recipientUnitId !== "",
    staleTime: 30 * 1000,
    ...rest,
  });
}

export function useGetLttpReceivingDefaultRecipientsListQuery(options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.receivingDefaultRecipientsList(),
    queryFn: () => apiRequest({ url: "/lttp/receiving-default-recipients", method: "get" }),
    enabled: skip !== true,
    staleTime: 30 * 1000,
    ...rest,
  });
}

export function usePutLttpReceivingDefaultRecipientMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/lttp/receiving-default-recipient", method: "put", data: body }),
    onSuccess: () => {
      invalidateLttpData(qc);
      qc.invalidateQueries({ queryKey: qk.lttp.receivingDefaultRecipientsList() });
      qc.invalidateQueries({ queryKey: ["lttp", "receivingDefaultRecipient"] });
    },
  });
}

export function useGetLttpIssueSlipsQuery(arg, options = {}) {
  const { unitId, from, to, recipientUnitId, page = 1, pageSize = 20 } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.lttp.issueSlips(unitId, from, to, recipientUnitId, page, pageSize),
    queryFn: () =>
      apiRequest({
        url: "/lttp/issue-slips",
        method: "get",
        params: {
          unitId,
          from,
          to,
          page,
          pageSize,
          ...(recipientUnitId != null && recipientUnitId !== ""
            ? { recipientUnitId: Number(recipientUnitId) }
            : {}),
        },
      }),
    enabled: skip !== true && unitId != null && unitId !== "",
    ...rest,
  });
}

export function useCreateLttpIssueSlipMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/lttp/issue-slips", method: "post", data: body }),
    onSuccess: () => invalidateLttpData(qc),
  });
}

export function useDeleteLttpIssueSlipMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id }) => apiRequest({ url: `/lttp/issue-slips/${id}`, method: "delete" }),
    onSuccess: () => invalidateLttpData(qc),
  });
}
