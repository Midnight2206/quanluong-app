"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";

/** Danh mục mẫu Drive (public, theo categoryKey) — dùng cho màn Bảng kê mua hàng, v.v. */
export function useChungTuTemplateCatalogQuery(categoryKey) {
  const keyTrim = categoryKey != null && String(categoryKey).trim() ? String(categoryKey).trim() : undefined;
  return useQuery({
    queryKey: qk.chungTuQuyetToan.templateCatalog(keyTrim),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/template-catalog",
        method: "get",
        params: keyTrim ? { categoryKey: keyTrim } : {},
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
  });
}
