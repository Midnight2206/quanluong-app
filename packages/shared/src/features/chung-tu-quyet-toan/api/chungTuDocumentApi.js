"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";
import httpClient from "@/services/httpClient";
import { useWrappedMutation } from "@/lib/useWrappedMutation";
import { getApiBaseUrl } from "@/utils/runtimeEnv";

function invalidateChungTuDocuments(qc, unitId, categoryKey) {
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.documents(unitId, categoryKey) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

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
  return useQuery({
    queryKey: qk.chungTuQuyetToan.documents(unitId, categoryKey),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/documents",
        method: "get",
        params: { unitId, categoryKey },
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
    enabled: Boolean(
      skip !== true && unitId != null && unitId !== "" && String(categoryKey ?? "").trim(),
    ),
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
      if (result?.unitId && result?.categoryKey) {
        invalidateChungTuDocuments(qc, result.unitId, result.categoryKey);
      }
    },
    onError: (_error, variables) => {
      if (variables?.unitId && variables?.categoryKey) {
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
      if (result?.unitId && result?.categoryKey) {
        invalidateChungTuDocuments(qc, result.unitId, result.categoryKey);
      }
    },
    onError: (_error, variables) => {
      if (variables?.unitId && variables?.categoryKey) {
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
      if (result?.unitId && result?.categoryKey) {
        invalidateChungTuDocuments(qc, result.unitId, result.categoryKey);
      }
    },
  });
}

export function buildChungTuDocumentPrintPdfUrl(documentKey) {
  const base = getApiBaseUrl();
  return `${base}/chungtuquyettoan/documents/${encodeURIComponent(documentKey)}/print-pdf`;
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

export function useChungTuExcelTemplatesQuery(categoryKey, options = {}) {
  const { skip, ...rest } = options;
  const key = String(categoryKey ?? "").trim();
  return useQuery({
    queryKey: qk.chungTuQuyetToan.excelTemplates(key),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/excel-templates",
        method: "get",
        params: { categoryKey: key },
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
    enabled: Boolean(skip !== true && key),
    ...rest,
  });
}

export function useUploadChungTuExcelTemplateMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ categoryKey, displayName, file }) => {
      const form = new FormData();
      form.append("categoryKey", categoryKey);
      form.append("displayName", displayName);
      form.append("file", file);
      return apiRequest({
        url: "/chungtuquyettoan/excel-templates",
        method: "post",
        data: form,
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.excelTemplates(variables?.categoryKey) });
    },
  });
}

export function usePutChungTuExcelTemplateMappingMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, mapping, isActive }) =>
      apiRequest({
        url: `/chungtuquyettoan/excel-templates/${encodeURIComponent(id)}/mapping`,
        method: "put",
        data: { mapping, isActive },
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.excelTemplates(data?.categoryKey) });
      qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.excelTemplate(data?.id) });
    },
  });
}

export function useChungTuExcelExportHistoryQuery(categoryKey, options = {}) {
  const { skip, ...rest } = options;
  const key = String(categoryKey ?? "").trim();
  return useQuery({
    queryKey: qk.chungTuQuyetToan.excelExportHistory(key),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/excel-exports/history",
        method: "get",
        params: { categoryKey: key },
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
    enabled: Boolean(skip !== true && key),
    ...rest,
  });
}

export function useExportBkmhExcelMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: async (body) => {
      const res = await httpClient({
        url: "/chungtuquyettoan/excel-exports/bkmh",
        method: "post",
        data: body,
        responseType: "blob",
      });
      const disposition = res.headers?.["content-disposition"] ?? "";
      const filenameMatch = String(disposition).match(/filename="?([^"]+)"?/i);
      return {
        blob: res.data,
        filename: filenameMatch?.[1] || `bang-ke-mua-hang-${body.periodMonth}.xlsx`,
        categoryKey: "bang-ke-mua-hang",
      };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.excelExportHistory(result?.categoryKey) });
    },
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
