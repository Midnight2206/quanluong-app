"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { useWrappedMutation } from "@/lib/useWrappedMutation";
import { apiRequest } from "@/services/apiRequest";
import { downloadBlobAsFile } from "@/utils/captureElementToPngCore";

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

function filenameFromContentDisposition(header) {
  if (!header || typeof header !== "string") {
    return null;
  }
  const utf8 = /filename\*=(?:UTF-8''|utf-8'')([^;\n]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const plain = /filename=([^;\n]+)/i.exec(header);
  if (plain?.[1]) {
    return plain[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

export async function downloadChungTuPdfExport(exportKey) {
  const key = exportKey != null ? String(exportKey).trim() : "";
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/pdf-exports/${encodeURIComponent(key)}/file`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/pdf" });
  const cd = headers?.["content-disposition"] ?? headers?.["Content-Disposition"];
  const fileName = filenameFromContentDisposition(cd) ?? `${key}.pdf`;
  downloadBlobAsFile(pdfBlob, fileName);
}
