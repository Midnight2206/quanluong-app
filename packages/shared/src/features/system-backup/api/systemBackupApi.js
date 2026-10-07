"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { useWrappedMutation } from "@/lib/useWrappedMutation";
import { apiRequest } from "@/services/apiRequest";

export function useSystemBackupQuery() {
  return useQuery({
    queryKey: qk.systemBackup.state(),
    queryFn: () => apiRequest({ url: "/system-backup", method: "get" }),
    refetchInterval: (query) => (query.state.data?.status?.state === "running" ? 2000 : 20000),
  });
}

export function useRestoreSystemBackupMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (date) =>
      apiRequest({ url: "/system-backup/restore", method: "post", data: { date } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.systemBackup.root }),
  });
}

export function useRunSystemBackupMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: () => apiRequest({ url: "/system-backup/backup", method: "post" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.systemBackup.root }),
  });
}
