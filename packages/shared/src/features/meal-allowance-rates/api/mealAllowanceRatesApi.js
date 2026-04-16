"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

export function useGetMealAllowanceRatesQuery() {
  return useQuery({
    queryKey: qk.mealAllowanceRates.list(),
    queryFn: () => apiRequest({ url: "/meal-allowance-rates", method: "get" }),
  });
}

export function useCreateMealAllowanceRateMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({ url: "/meal-allowance-rates", method: "post", data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.mealAllowanceRates.root }),
  });
}

export function usePatchMealAllowanceRateMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, body }) =>
      apiRequest({ url: `/meal-allowance-rates/${id}`, method: "patch", data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.mealAllowanceRates.root }),
  });
}

export function useDeleteMealAllowanceRateMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (id) => apiRequest({ url: `/meal-allowance-rates/${id}`, method: "delete" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.mealAllowanceRates.root }),
  });
}
