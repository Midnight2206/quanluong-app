"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";

export function buildTemplateFullDisplayName(folderPath, templateName, separator = " / ") {
  const folders = (Array.isArray(folderPath) ? folderPath : [])
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  const leaf = String(templateName ?? "").trim();
  const parts = leaf ? [...folders, leaf] : folders;
  return parts.join(separator);
}

export function useChungTuTemplateTreeQuery(folderId, options = {}) {
  const { skip, categoryKey, ...rest } = options;
  const id = folderId != null && String(folderId).trim() ? String(folderId).trim() : undefined;
  const cat =
    categoryKey != null && String(categoryKey).trim() ? String(categoryKey).trim() : undefined;
  return useQuery({
    queryKey: qk.chungTuQuyetToan.templateTree(id, cat),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/template-tree",
        method: "get",
        params: {
          ...(id ? { folderId: id } : {}),
          ...(cat && !id ? { categoryKey: cat } : {}),
        },
      }),
    enabled: skip !== true,
    ...rest,
  });
}
