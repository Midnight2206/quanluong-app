"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

function invalidateMealRoster(qc, unitId, yearMonth) {
  qc.invalidateQueries({ queryKey: qk.mealRoster.list(unitId, yearMonth) });
  qc.invalidateQueries({ queryKey: qk.mealRoster.meta(unitId, yearMonth) });
  qc.invalidateQueries({ queryKey: qk.mealRoster.dayMarks(unitId, yearMonth) });
  qc.invalidateQueries({ queryKey: qk.mealRoster.root });
}

export function useGetMealRosterQuery(arg, options = {}) {
  const { unitId, yearMonth } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.mealRoster.list(unitId, yearMonth),
    queryFn: () =>
      apiRequest({
        url: "/meal-roster",
        method: "get",
        params: { unitId, yearMonth },
      }),
    enabled: skip !== true && unitId != null && yearMonth != null && yearMonth !== "",
    ...rest,
  });
}

export function useGetMealRosterMetaQuery(arg, options = {}) {
  const { unitId, yearMonth } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.mealRoster.meta(unitId, yearMonth),
    queryFn: () =>
      apiRequest({
        url: "/meal-roster/meta",
        method: "get",
        params: {
          unitId,
          ...(yearMonth != null && yearMonth !== "" ? { yearMonth } : {}),
        },
      }),
    enabled: skip !== true && unitId != null,
    ...rest,
  });
}

export function useCreateMealRosterEntryMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/meal-roster", method: "post", data: body }),
    onSuccess: (_d, body) => invalidateMealRoster(qc, body.unitId, body.yearMonth),
  });
}

export function usePatchMealRosterEntryMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, body, unitId, yearMonth }) =>
      apiRequest({ url: `/meal-roster/${id}`, method: "patch", data: body }),
    onSuccess: (_d, arg) => invalidateMealRoster(qc, arg.unitId, arg.yearMonth),
  });
}

export function useDeleteMealRosterEntryMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, unitId, yearMonth }) =>
      apiRequest({ url: `/meal-roster/${id}`, method: "delete" }),
    onSuccess: (_d, arg) => invalidateMealRoster(qc, arg.unitId, arg.yearMonth),
  });
}

export function useImportMealRosterMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ file, unitId, yearMonth }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("unitId", String(unitId));
      fd.append("yearMonth", yearMonth);
      return apiRequest({ url: "/meal-roster/import", method: "post", data: fd });
    },
    onSuccess: (_d, { unitId, yearMonth }) => invalidateMealRoster(qc, unitId, yearMonth),
  });
}

export function useCopyMealRosterPreviousMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/meal-roster/copy-previous", method: "post", data: body }),
    onSuccess: (_d, { unitId, yearMonth }) => invalidateMealRoster(qc, unitId, yearMonth),
  });
}

export function useGetMealRateCatalogQuery(_arg, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.mealRoster.catalog(),
    queryFn: () => apiRequest({ url: "/meal-roster/rate-catalog", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function usePutSelectedMealRatesMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/meal-roster/selected-rates", method: "put", data: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.mealRoster.catalog() });
      qc.invalidateQueries({ queryKey: qk.mealRoster.root });
    },
  });
}

export function useGetMealRosterDayMarksQuery(arg, options = {}) {
  const { unitId, yearMonth } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.mealRoster.dayMarks(unitId, yearMonth),
    queryFn: () =>
      apiRequest({
        url: "/meal-roster/day-marks",
        method: "get",
        params: { unitId, yearMonth },
      }),
    enabled: skip !== true && unitId != null && yearMonth != null && yearMonth !== "",
    ...rest,
  });
}

export function usePutMealRosterDayMarksMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/meal-roster/day-marks", method: "put", data: body }),
    onSuccess: (_d, arg) => {
      qc.invalidateQueries({ queryKey: qk.mealRoster.dayMarks(arg.unitId, arg.yearMonth) });
    },
  });
}
