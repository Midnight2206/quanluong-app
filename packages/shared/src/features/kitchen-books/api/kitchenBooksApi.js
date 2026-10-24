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
      qc.invalidateQueries({ queryKey: qk.kitchenBooks.menuDetail(unitId, date) });
    }
    if (yearMonth) {
      qc.invalidateQueries({ queryKey: qk.kitchenBooks.monthMarkers(unitId, yearMonth) });
    }
  }
}

function invalidateMenuSamples(qc) {
  qc.invalidateQueries({ queryKey: ["kitchenBooks", "menuSamples"] });
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

export function useGetKitchenMenuDetailQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.menuDetail(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/menu/detail",
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

export function useGetKitchenMenuSamplesQuery(arg, options = {}) {
  const { unitId, mealPeriod, rateId } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.menuSamples(unitId, mealPeriod, rateId),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/menu-samples",
        method: "get",
        params: {
          unitId,
          mealPeriod: mealPeriod || undefined,
          rateId: rateId || undefined,
        },
      }),
    enabled: skip !== true && unitId != null,
    ...rest,
  });
}

export function useCreateKitchenMenuSampleMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/menu-samples", method: "post", data: body }),
    onSuccess: () => {
      invalidateMenuSamples(qc);
    },
  });
}

export function useUpdateKitchenMenuSampleMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, ...body }) =>
      apiRequest({ url: `/kitchen-books/menu-samples/${id}`, method: "put", data: body }),
    onSuccess: () => {
      invalidateMenuSamples(qc);
    },
  });
}

export function useDeleteKitchenMenuSampleMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, unitId }) =>
      apiRequest({
        url: `/kitchen-books/menu-samples/${id}`,
        method: "delete",
        params: { unitId },
      }),
    onSuccess: () => {
      invalidateMenuSamples(qc);
    },
  });
}

export function useApplyKitchenMenuSampleMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, ...body }) =>
      apiRequest({
        url: `/kitchen-books/menu-samples/${id}/apply`,
        method: "post",
        data: body,
      }),
    onSuccess: (_d, vars) => {
      invalidateMenuSamples(qc);
      const ym = vars?.date ? String(vars.date).slice(0, 7) : null;
      invalidateKitchenBooks(qc, vars?.unitId, vars?.date, ym);
    },
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

export function useSuggestKitchenMenuAiMutation() {
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/menu/ai-suggest", method: "post", data: body }),
  });
}

export function useApplyKitchenMenuAiMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/menu/ai-apply", method: "post", data: body }),
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

function invalidateLedger(qc, unitId, date) {
  if (unitId == null) return;
  const ledgerKey = date
    ? qk.kitchenBooks.ledger(unitId, date)
    : ["kitchenBooks", "ledger", String(unitId)];
  qc.invalidateQueries({ queryKey: ledgerKey });
  qc.invalidateQueries({ queryKey: qk.kitchenBooks.ledgerSettings(unitId) });
}

export function useGetKitchenLedgerQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.ledger(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/ledger",
        method: "get",
        params: { unitId, date },
      }),
    enabled: skip !== true && unitId != null && Boolean(date),
    ...rest,
  });
}

export function useSaveKitchenLedgerMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/ledger", method: "put", data: body }),
    onSuccess: (_data, vars) => invalidateLedger(qc, vars?.unitId, vars?.date),
  });
}

export function useLockKitchenLedgerMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/ledger/lock", method: "post", data: body }),
    onSuccess: (_data, vars) => invalidateLedger(qc, vars?.unitId, vars?.date),
  });
}

export function useUnlockKitchenLedgerMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/ledger/unlock", method: "post", data: body }),
    onSuccess: (_data, vars) => invalidateLedger(qc, vars?.unitId, vars?.date),
  });
}

export function useBalanceKitchenLedgerMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/ledger/balance", method: "post", data: body }),
    onSuccess: (_data, vars) => invalidateLedger(qc, vars?.unitId, vars?.date),
  });
}

export function useSaveKitchenLedgerSettingsMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/ledger/settings", method: "put", data: body }),
    onSuccess: (_data, vars) => invalidateLedger(qc, vars?.unitId, null),
  });
}

function invalidateAssistant(qc, unitId, date, { ledger = false } = {}) {
  if (unitId == null) return;
  qc.invalidateQueries({ queryKey: qk.kitchenBooks.ledgerAssistant(unitId, date) });
  if (ledger) invalidateLedger(qc, unitId, null);
}

export function useGetKitchenLedgerAssistantQuery(arg, options = {}) {
  const { unitId, date } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.ledgerAssistant(unitId, date),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/ledger/assistant",
        method: "get",
        params: { unitId, date },
      }),
    enabled: skip !== true && unitId != null && Boolean(date),
    ...rest,
  });
}

export function useLedgerAssistantTurnMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/ledger/assistant/turn", method: "post", data: body }),
    onSettled: (_data, _err, vars) => invalidateAssistant(qc, vars?.unitId, vars?.date),
  });
}

export function useApplyLedgerAssistantMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/ledger/assistant/apply", method: "post", data: body }),
    onSettled: (_data, _err, vars) => invalidateAssistant(qc, vars?.unitId, vars?.date, { ledger: true }),
  });
}

export function useSaveLedgerAssistantProfileMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/ledger/assistant/profile", method: "put", data: body }),
    onSuccess: (_data, vars) => invalidateAssistant(qc, vars?.unitId, vars?.date),
  });
}

export function useAddLedgerAssistantMemoryMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/kitchen-books/ledger/assistant/memory", method: "post", data: body }),
    onSuccess: (_data, vars) => invalidateAssistant(qc, vars?.unitId, vars?.date),
  });
}

export function useDeleteLedgerAssistantMemoryMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ unitId, id, date }) =>
      apiRequest({
        url: "/kitchen-books/ledger/assistant/memory",
        method: "delete",
        params: { unitId, id },
      }).then((data) => ({ ...data, unitId, date })),
    onSuccess: (data) => invalidateAssistant(qc, data?.unitId, data?.date),
  });
}

export function useDeleteLedgerAssistantRuleMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ unitId, id, date }) =>
      apiRequest({
        url: "/kitchen-books/ledger/assistant/rules",
        method: "delete",
        params: { unitId, id },
      }).then((data) => ({ ...data, unitId, date })),
    onSuccess: (data) => invalidateAssistant(qc, data?.unitId, data?.date),
  });
}
