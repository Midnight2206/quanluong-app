"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";

export function useGetChungTuQuyetToanHealthQuery(options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.chungTuQuyetToan.health(),
    queryFn: () => apiRequest({ url: "/chungtuquyettoan/health", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}
