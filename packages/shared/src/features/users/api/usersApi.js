"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

export function useGetUsersQuery(_arg, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.users.list(),
    queryFn: () => apiRequest({ url: "/users", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/users", method: "post", data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users.root }),
  });
}

export function usePatchUserMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, ...body }) =>
      apiRequest({ url: `/users/${id}`, method: "patch", data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users.root }),
  });
}

/** @deprecated Dùng queryClient.invalidateQueries({ queryKey: qk.users.root }) */
export const usersApi = {
  endpoints: {
    getUsers: {
      initiate: (_arg, { queryClient }) => queryClient.invalidateQueries({ queryKey: qk.users.list() }),
    },
  },
};
