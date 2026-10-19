"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";

const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== "" && v != null));

export function useAuditLogListQuery(tab, filters, cursor) {
  const params = clean({ ...filters, cursor });
  return useQuery({
    queryKey: qk.auditLogs.list(tab, params),
    queryFn: () => apiRequest({ url: `/audit-logs/${tab}`, method: "get", params, skipTargetUnitHeader: true }),
  });
}

export function useAuditLogUsersQuery() {
  return useQuery({
    queryKey: qk.auditLogs.users(),
    queryFn: () => apiRequest({ url: "/audit-logs/users", method: "get", skipTargetUnitHeader: true }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAuditChangeDetailQuery(id) {
  return useQuery({
    queryKey: qk.auditLogs.change(id),
    queryFn: () => apiRequest({ url: `/audit-logs/changes/${id}`, method: "get", skipTargetUnitHeader: true }),
    enabled: Boolean(id),
  });
}

/** Tải Excel theo bộ lọc hiện tại. */
export async function downloadAuditLogExcel(tab, filters) {
  const blob = await apiRequest({
    url: `/audit-logs/${tab}/export`,
    method: "get",
    params: clean(filters),
    responseType: "blob",
    skipTargetUnitHeader: true,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nhat-ky-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useAuditUsagePagesQuery(userId, day) {
  return useQuery({
    queryKey: ["auditLogs", "usagePages", String(userId), day],
    queryFn: () => apiRequest({ url: "/audit-logs/usage/pages", method: "get", params: { userId, day }, skipTargetUnitHeader: true }),
    enabled: Boolean(userId && day),
  });
}
