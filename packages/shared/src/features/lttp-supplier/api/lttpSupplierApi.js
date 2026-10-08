"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/services/apiRequest";

export function useLttpSupplierCatalogQuery(options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: ["lttp-supplier", "catalog"],
    queryFn: () => apiRequest({ url: "/lttp-supplier/catalog", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function getLttpSupplierUserLinksQueryOptions(userId) {
  return {
    queryKey: ["lttp-supplier", "user-links", userId],
    queryFn: () => apiRequest({ url: `/lttp-supplier/users/${userId}/links`, method: "get" }),
  };
}
