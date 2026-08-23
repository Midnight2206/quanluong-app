"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { useWrappedMutation } from "@/lib/useWrappedMutation";
import { apiRequest } from "@/services/apiRequest";

function normalizeCategoryKey(categoryKey) {
  return categoryKey != null ? String(categoryKey).trim() : "";
}

function invalidateChungTuPdfTemplates(qc, categoryKey) {
  const key = normalizeCategoryKey(categoryKey);
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfTemplates(key) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

function invalidateChungTuPdfExports(qc, unitId, categoryKey) {
  const key = normalizeCategoryKey(categoryKey);
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfExports(unitId, key) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfExports(unitId) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

export function useChungTuPdfTemplatesQuery(categoryKey, options = {}) {
  const { skip, ...rest } = options;
  const key = normalizeCategoryKey(categoryKey);
  return useQuery({
    queryKey: qk.chungTuQuyetToan.pdfTemplates(key),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/pdf-templates",
        method: "get",
        params: { categoryKey: key },
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
    enabled: Boolean(skip !== true && key.length > 0),
    ...rest,
  });
}

export function useUploadChungTuPdfTemplateMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ file, categoryKey, displayName, name, version }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("categoryKey", normalizeCategoryKey(categoryKey));
      fd.append("displayName", displayName ?? name ?? "");
      fd.append("name", name ?? "");
      fd.append("version", version ?? "");
      return apiRequest({
        url: "/chungtuquyettoan/pdf-templates",
        method: "post",
        data: fd,
      });
    },
    onSuccess: (_data, variables) => {
      invalidateChungTuPdfTemplates(qc, variables?.categoryKey);
    },
  });
}

export function useDeactivateChungTuPdfTemplateMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id }) =>
      apiRequest({
        url: `/chungtuquyettoan/pdf-templates/${encodeURIComponent(id)}`,
        method: "delete",
      }),
    onSuccess: (_data, variables) => {
      invalidateChungTuPdfTemplates(qc, variables?.categoryKey);
      if (variables?.id != null) {
        qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfTemplateFields(variables.id) });
      }
    },
  });
}

export function useChungTuPdfTemplateFieldsQuery(templateId, options = {}) {
  const { skip, ...rest } = options;
  const id = templateId != null ? String(templateId).trim() : "";
  return useQuery({
    queryKey: qk.chungTuQuyetToan.pdfTemplateFields(id),
    queryFn: () =>
      apiRequest({
        url: `/chungtuquyettoan/pdf-templates/${encodeURIComponent(id)}/fields`,
        method: "get",
      }),
    enabled: Boolean(skip !== true && id.length > 0),
    ...rest,
  });
}

export function useCreateChungTuPdfExportMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({
        url: "/chungtuquyettoan/pdf-exports",
        method: "post",
        data: body,
      }),
    onSuccess: (data, variables) => {
      invalidateChungTuPdfExports(
        qc,
        data?.unitId ?? variables?.unitId,
        data?.categoryKey ?? variables?.categoryKey,
      );
    },
  });
}

export function useChungTuPdfExportsQuery({ unitId, categoryKey } = {}, options = {}) {
  const { skip, ...rest } = options;
  const key = normalizeCategoryKey(categoryKey);
  return useQuery({
    queryKey: qk.chungTuQuyetToan.pdfExports(unitId, key),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/pdf-exports",
        method: "get",
        params: { unitId, ...(key ? { categoryKey: key } : {}) },
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
    enabled: Boolean(skip !== true && unitId != null && unitId !== ""),
    ...rest,
  });
}

export function useDeleteChungTuPdfExportMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ exportKey }) =>
      apiRequest({
        url: `/chungtuquyettoan/pdf-exports/${encodeURIComponent(exportKey)}`,
        method: "delete",
      }),
    onSuccess: (_data, variables) => {
      invalidateChungTuPdfExports(qc, variables?.unitId, variables?.categoryKey);
    },
  });
}

export async function downloadChungTuPdfExport(exportKey) {
  const key = exportKey != null ? String(exportKey).trim() : "";
  const tab = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
  try {
    const blob = await apiRequest({
      url: `/chungtuquyettoan/pdf-exports/${encodeURIComponent(key)}/file`,
      method: "get",
      responseType: "blob",
    });
    const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/pdf" });
    const url = URL.createObjectURL(pdfBlob);
    if (tab) {
      tab.location.href = url;
    } else if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return url;
  } catch (error) {
    if (tab) {
      tab.close();
    }
    throw error;
  }
}
