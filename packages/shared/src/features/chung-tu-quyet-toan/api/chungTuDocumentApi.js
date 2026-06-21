"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

function invalidateChungTuDocuments(qc, unitId, categoryKey) {
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.documents(unitId, categoryKey) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.documents(unitId) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

export const CHUNG_TU_AGGREGATION_MODES = Object.freeze({
  BY_DAY: "by-day",
  BY_UNIT: "by-unit",
  FULL: "full",
});

export const CHUNG_TU_AGGREGATION_MODE_OPTIONS = Object.freeze([
  { value: CHUNG_TU_AGGREGATION_MODES.BY_DAY, label: "Theo ngày", hint: "Mỗi sheet = một ngày trong tháng." },
  { value: CHUNG_TU_AGGREGATION_MODES.BY_UNIT, label: "Theo đơn vị", hint: "Mỗi sheet = tổng cả tháng của một đơn vị." },
  { value: CHUNG_TU_AGGREGATION_MODES.FULL, label: "Toàn bộ", hint: "Gộp tất cả đơn vị và ngày vào một sheet." },
]);

export function useChungTuCategoryTemplatesQuery(categoryKey, options = {}) {
  const { skip, ...rest } = options;
  const key = categoryKey != null ? String(categoryKey).trim() : "";
  return useQuery({
    queryKey: qk.chungTuQuyetToan.categoryTemplates(key),
    queryFn: () =>
      apiRequest({
        url: `/chungtuquyettoan/category-templates/${encodeURIComponent(key)}`,
        method: "get",
      }),
    enabled: Boolean(skip !== true && key.length > 0),
    ...rest,
  });
}

export function useChungTuUnitProfileQuery(unitId, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.chungTuQuyetToan.unitProfile(unitId),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/unit-profile",
        method: "get",
        params: { unitId },
      }),
    enabled: Boolean(skip !== true && unitId != null && unitId !== ""),
    ...rest,
  });
}

export function usePutChungTuUnitProfileMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({
        url: "/chungtuquyettoan/unit-profile",
        method: "put",
        data: body,
      }),
    onSuccess: (_data, variables) => {
      if (variables?.unitId != null) {
        qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.unitProfile(variables.unitId) });
      }
    },
  });
}

export function useChungTuDocumentsQuery({ unitId, categoryKey }, options = {}) {
  const { skip, ...rest } = options;
  const cat =
    categoryKey != null && String(categoryKey).trim() ? String(categoryKey).trim() : undefined;
  return useQuery({
    queryKey: qk.chungTuQuyetToan.documents(unitId, cat),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/documents",
        method: "get",
        params: { unitId, ...(cat ? { categoryKey: cat } : {}) },
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
    enabled: Boolean(skip !== true && unitId != null && unitId !== ""),
    ...rest,
  });
}

export function useCreateChungTuDocumentMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({
        url: "/chungtuquyettoan/documents",
        method: "post",
        data: body,
      }),
    onSuccess: (_data, variables) => {
      invalidateChungTuDocuments(qc, variables?.unitId, variables?.categoryKey);
    },
  });
}

export function useSyncChungTuDocumentMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: async ({ documentKey, unitId, categoryKey }) => {
      const data = await apiRequest({
        url: `/chungtuquyettoan/documents/${encodeURIComponent(documentKey)}/sync`,
        method: "post",
      });
      return { ...data, unitId, categoryKey };
    },
    onSuccess: (result) => {
      if (result?.unitId) {
        invalidateChungTuDocuments(qc, result.unitId, result.categoryKey);
      }
    },
    onError: (_error, variables) => {
      if (variables?.unitId) {
        invalidateChungTuDocuments(qc, variables.unitId, variables.categoryKey);
      }
    },
  });
}

export function useOpenChungTuDocumentMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: async ({ documentKey, unitId, categoryKey }) => {
      const data = await apiRequest({
        url: `/chungtuquyettoan/documents/${encodeURIComponent(documentKey)}`,
        method: "get",
      });
      return { ...data, unitId, categoryKey };
    },
    onSuccess: (result) => {
      if (result?.unitId) {
        invalidateChungTuDocuments(qc, result.unitId, result.categoryKey);
      }
    },
    onError: (_error, variables) => {
      if (variables?.unitId) {
        invalidateChungTuDocuments(qc, variables.unitId, variables.categoryKey);
      }
    },
  });
}

export function useDeleteChungTuDocumentMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: async ({ documentKey, unitId, categoryKey }) => {
      const data = await apiRequest({
        url: `/chungtuquyettoan/documents/${encodeURIComponent(documentKey)}`,
        method: "delete",
      });
      return { ...data, unitId, categoryKey };
    },
    onSuccess: (result) => {
      if (result?.unitId) {
        invalidateChungTuDocuments(qc, result.unitId, result.categoryKey);
      }
    },
  });
}

export function useChungTuContextPreviewMutation() {
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({
        url: "/chungtuquyettoan/context-preview",
        method: "post",
        data: body,
      }),
  });
}

export function useChungTuTemplateFillMappingQuery(
  { categoryKey, driveFileId },
  options = {},
) {
  const { skip, ...rest } = options;
  const cat = categoryKey != null ? String(categoryKey).trim() : "";
  const fileId = driveFileId != null ? String(driveFileId).trim() : "";
  return useQuery({
    queryKey: qk.chungTuQuyetToan.templateFillMapping(cat, fileId),
    queryFn: () =>
      apiRequest({
        url: `/chungtuquyettoan/category-templates/${encodeURIComponent(cat)}/${encodeURIComponent(fileId)}/fill-mapping`,
        method: "get",
      }),
    enabled: Boolean(skip !== true && cat.length > 0 && fileId.length > 0),
    ...rest,
  });
}

export function usePutChungTuTemplateFillMappingMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ categoryKey, driveFileId, fillRules }) =>
      apiRequest({
        url: `/chungtuquyettoan/category-templates/${encodeURIComponent(categoryKey)}/${encodeURIComponent(driveFileId)}/fill-mapping`,
        method: "put",
        data: { fillRules },
      }),
    onSuccess: (_data, variables) => {
      if (variables?.categoryKey && variables?.driveFileId) {
        qc.invalidateQueries({
          queryKey: qk.chungTuQuyetToan.templateFillMapping(
            variables.categoryKey,
            variables.driveFileId,
          ),
        });
      }
    },
  });
}
