"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

export function useGetJobTitlesQuery(_arg, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.jobTitles.list(),
    queryFn: () => apiRequest({ url: "/job-titles", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useCreateJobTitleMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/job-titles", method: "post", data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobTitles.root }),
  });
}

export function usePatchJobTitleMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, ...body }) =>
      apiRequest({ url: `/job-titles/${id}`, method: "patch", data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobTitles.root }),
  });
}

export function useSetJobTitlePermissionsMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, permissionIds }) =>
      apiRequest({
        url: `/job-titles/${id}/permissions`,
        method: "put",
        data: { permissionIds },
      }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: qk.jobTitles.root });
      qc.invalidateQueries({ queryKey: qk.jobTitles.detail(id) });
    },
  });
}

export function useDeleteJobTitleMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (id) => apiRequest({ url: `/job-titles/${id}`, method: "delete" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobTitles.root }),
  });
}
