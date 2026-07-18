"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

function invalidateKitchenBooks(qc, unitId, date, yearMonth) {
  qc.invalidateQueries({ queryKey: qk.kitchenBooks.root });
  if (unitId != null) {
    qc.invalidateQueries({ queryKey: qk.kitchenBooks.catalog(unitId) });
    if (date) {
      qc.invalidateQueries({ queryKey: qk.kitchenBooks.menu(unitId, date) });
    }
    if (yearMonth) {
      qc.invalidateQueries({ queryKey: qk.kitchenBooks.monthMarkers(unitId, yearMonth) });
    }
  }
}

export function useGetKitchenCatalogQuery(arg, options = {}) {
  const { unitId, q } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.catalog(unitId, q),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/catalog",
        method: "get",
        params: { unitId, q: q || undefined },
      }),
    enabled: skip !== true && unitId != null,
    ...rest,
  });
}

export function useGetKitchenMenuQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.menu(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/menu",
        method: "get",
        params: { unitId, date },
      }),
    enabled: skip !== true && unitId != null && date != null && date !== "",
    ...rest,
  });
}

export function useGetKitchenMenuMonthMarkersQuery(arg, options = {}) {
  const { unitId, yearMonth } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.monthMarkers(unitId, yearMonth),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/menu/month-markers",
        method: "get",
        params: { unitId, yearMonth },
      }),
    enabled: skip !== true && unitId != null && yearMonth != null && yearMonth !== "",
    ...rest,
  });
}

export function useCreateKitchenCatalogMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/catalog", method: "post", data: body }),
    onSuccess: (_d, vars) => {
      invalidateKitchenBooks(qc, vars?.unitId);
    },
  });
}

export function useUpdateKitchenCatalogMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, ...body }) =>
      apiRequest({ url: `/kitchen-books/catalog/${id}`, method: "put", data: body }),
    onSuccess: (_d, vars) => {
      invalidateKitchenBooks(qc, vars?.unitId);
    },
  });
}

export function useDeleteKitchenCatalogMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, unitId }) =>
      apiRequest({
        url: `/kitchen-books/catalog/${id}`,
        method: "delete",
        params: { unitId },
      }),
    onSuccess: (_d, vars) => {
      invalidateKitchenBooks(qc, vars?.unitId);
    },
  });
}

export function usePutKitchenMenuMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/kitchen-books/menu", method: "put", data: body }),
    onSuccess: (_d, vars) => {
      const ym = vars?.date ? String(vars.date).slice(0, 7) : null;
      invalidateKitchenBooks(qc, vars?.unitId, vars?.date, ym);
    },
  });
}

export function useImportKitchenCatalogToMenuMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/menu/import-catalog", method: "post", data: body }),
    onSuccess: (_d, vars) => {
      const ym = vars?.date ? String(vars.date).slice(0, 7) : null;
      invalidateKitchenBooks(qc, vars?.unitId, vars?.date, ym);
    },
  });
}

export function useDeleteKitchenMenuDishMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ dishId, unitId, date }) =>
      apiRequest({
        url: `/kitchen-books/menu/dish/${dishId}`,
        method: "delete",
        params: { unitId },
      }).then((r) => {
        const ym = date ? String(date).slice(0, 7) : null;
        invalidateKitchenBooks(qc, unitId, date, ym);
        return r;
      }),
  });
}

function invalidateReceiptSlips(qc, unitId, date) {
  qc.invalidateQueries({ queryKey: qk.kitchenBooks.root });
  if (unitId != null) {
    qc.invalidateQueries({ queryKey: qk.kitchenBooks.receiptSlips(unitId, date) });
    qc.invalidateQueries({ queryKey: qk.kitchenBooks.receiptSlipByDay(unitId, date) });
    qc.invalidateQueries({ queryKey: qk.kitchenBooks.receiptSlipSerial(unitId, date) });
    qc.invalidateQueries({ queryKey: qk.kitchenBooks.receiptGuaranteeFromIssue(unitId, date) });
  }
}

export function useGetKitchenReceiptSlipsQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.receiptSlips(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/receipt-slips",
        method: "get",
        params: { unitId, date: date || undefined },
      }),
    enabled: skip !== true && unitId != null,
    ...rest,
  });
}

export function useGetKitchenReceiptSlipByDayQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.receiptSlipByDay(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/receipt-slips/by-day",
        method: "get",
        params: { unitId, date },
      }),
    enabled: skip !== true && unitId != null && date != null && date !== "",
    ...rest,
  });
}

export function useUpsertKitchenReceiptUnitSelfMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({
        url: "/kitchen-books/receipt-slips/by-day",
        method: "put",
        data: body,
      }),
    onSuccess: (_d, vars) => {
      invalidateReceiptSlips(qc, vars?.unitId, vars?.receiptDate);
    },
  });
}

export function useGetKitchenReceiptSlipSerialQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.receiptSlipSerial(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/receipt-slips/next-serial",
        method: "get",
        params: { unitId, date },
      }),
    enabled: skip !== true && unitId != null && date != null && date !== "",
    ...rest,
  });
}

export function useGetKitchenReceiptGuaranteeFromIssueQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.receiptGuaranteeFromIssue(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/receipt-slips/guarantee-from-issue",
        method: "get",
        params: { unitId, date },
      }),
    enabled: skip !== true && unitId != null && date != null && date !== "",
    ...rest,
  });
}

export function useCreateKitchenReceiptSlipMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/receipt-slips", method: "post", data: body }),
    onSuccess: (_d, vars) => {
      invalidateReceiptSlips(qc, vars?.unitId, vars?.receiptDate);
    },
  });
}

export function useUpdateKitchenReceiptSlipMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, ...body }) =>
      apiRequest({ url: `/kitchen-books/receipt-slips/${id}`, method: "patch", data: body }),
    onSuccess: (data) => {
      const slip = data?.data ?? data;
      invalidateReceiptSlips(qc, slip?.unitId, slip?.receiptDate);
      if (slip?.id != null) {
        qc.invalidateQueries({ queryKey: qk.kitchenBooks.receiptSlip(slip.id) });
      }
    },
  });
}

export function useDeleteKitchenReceiptSlipMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (id) =>
      apiRequest({ url: `/kitchen-books/receipt-slips/${id}`, method: "delete" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.kitchenBooks.root });
    },
  });
}
