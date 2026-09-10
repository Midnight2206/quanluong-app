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
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfTemplates(key, "published") });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfTemplates(key, "all") });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

function invalidateChungTuPdfExports(qc, unitId, categoryKey) {
  const key = normalizeCategoryKey(categoryKey);
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfExports(unitId, key) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfExports(unitId) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

function invalidateChungTuPdfExportBatches(qc, unitId, categoryKey) {
  const key = normalizeCategoryKey(categoryKey);
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfExportBatches(unitId, key) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfExportBatches(unitId) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

function invalidateChungTuSignatureSettings(qc, categoryKey) {
  const key = normalizeCategoryKey(categoryKey);
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.signatureSettings(key) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

function invalidateChungTuBkmhHeaderSettings(qc, categoryKey) {
  const key = normalizeCategoryKey(categoryKey);
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.bkmhHeaderSettings(key) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

export function useChungTuPdfTemplatesQuery(categoryKey, options = {}) {
  const { skip, includeNonPublished, ...rest } = options;
  const key = normalizeCategoryKey(categoryKey);
  const wantNonPublished = Boolean(includeNonPublished);
  return useQuery({
    queryKey: qk.chungTuQuyetToan.pdfTemplates(key, wantNonPublished ? "all" : "published"),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/pdf-templates",
        method: "get",
        params: {
          categoryKey: key,
          ...(wantNonPublished ? { includeNonPublished: true } : {}),
        },
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

export function usePublishChungTuPdfTemplateMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id }) =>
      apiRequest({
        url: `/chungtuquyettoan/pdf-templates/${encodeURIComponent(id)}/publish`,
        method: "post",
      }),
    onSuccess: (_data, variables) => {
      invalidateChungTuPdfTemplates(qc, variables?.categoryKey);
      if (variables?.id != null) {
        qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfTemplateFields(variables.id) });
      }
    },
  });
}

export function useRetireChungTuPdfTemplateMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id }) =>
      apiRequest({
        url: `/chungtuquyettoan/pdf-templates/${encodeURIComponent(id)}/retire`,
        method: "post",
      }),
    onSuccess: (_data, variables) => {
      invalidateChungTuPdfTemplates(qc, variables?.categoryKey);
      if (variables?.id != null) {
        qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfTemplateFields(variables.id) });
      }
    },
  });
}

export function useDeactivateChungTuPdfTemplateMutation() {
  return useRetireChungTuPdfTemplateMutation();
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

export function useUpdateChungTuPdfTemplateFieldLabelsMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, fieldLabels }) => {
      const templateId = id != null ? String(id).trim() : "";
      return apiRequest({
        url: `/chungtuquyettoan/pdf-templates/${encodeURIComponent(templateId)}/field-labels`,
        method: "put",
        data: { fieldLabels: fieldLabels ?? {} },
      });
    },
    onSuccess: (_data, variables) => {
      invalidateChungTuPdfTemplates(qc, variables?.categoryKey);
      if (variables?.id != null) {
        qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.pdfTemplateFields(variables.id) });
      }
    },
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

export function useCreateChungTuPdfExportBatchMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({
        url: "/chungtuquyettoan/pdf-export-batches",
        method: "post",
        data: body,
      }),
    onSuccess: (data, variables) => {
      invalidateChungTuPdfExportBatches(
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

export function useChungTuPdfExportBatchesQuery({ unitId, categoryKey } = {}, options = {}) {
  const { skip, ...rest } = options;
  const key = normalizeCategoryKey(categoryKey);
  return useQuery({
    queryKey: qk.chungTuQuyetToan.pdfExportBatches(unitId, key),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/pdf-export-batches",
        method: "get",
        params: { unitId, ...(key ? { categoryKey: key } : {}) },
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
    enabled: Boolean(skip !== true && unitId != null && unitId !== ""),
    ...rest,
  });
}

export function useDeleteChungTuPdfExportBatchMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ batchKey }) =>
      apiRequest({
        url: `/chungtuquyettoan/pdf-export-batches/${encodeURIComponent(batchKey)}`,
        method: "delete",
      }),
    onSuccess: (_data, variables) => {
      invalidateChungTuPdfExportBatches(qc, variables?.unitId, variables?.categoryKey);
    },
  });
}

export function useReExportPdfBatchMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ batchKey, pdfTemplateId, refreshData, ...rest }) =>
      apiRequest({
        url: `/chungtuquyettoan/pdf-export-batches/${encodeURIComponent(batchKey)}/re-export`,
        method: "post",
        data: { pdfTemplateId, refreshData: Boolean(refreshData), ...rest },
      }),
    onSuccess: (data, variables) => {
      invalidateChungTuPdfExportBatches(
        qc,
        data?.unitId ?? variables?.unitId,
        data?.categoryKey ?? variables?.categoryKey,
      );
    },
  });
}

export function useChungTuSignatureSettingsQuery(categoryKey, options = {}) {
  const { skip, ...rest } = options;
  const key = normalizeCategoryKey(categoryKey);
  return useQuery({
    queryKey: qk.chungTuQuyetToan.signatureSettings(key),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/signature-settings",
        method: "get",
        params: { categoryKey: key },
      }),
    enabled: Boolean(skip !== true && key.length > 0),
    ...rest,
  });
}

export function useUpsertChungTuSignatureSettingsMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ categoryKey, signatureBlock, extraFields }) =>
      apiRequest({
        url: "/chungtuquyettoan/signature-settings",
        method: "put",
        data: {
          categoryKey: normalizeCategoryKey(categoryKey),
          signatureBlock,
          extraFields,
        },
      }),
    onSuccess: (data, variables) => {
      invalidateChungTuSignatureSettings(qc, data?.categoryKey ?? variables?.categoryKey);
    },
  });
}

export function useChungTuBkmhHeaderSettingsQuery(categoryKey, options = {}) {
  const { skip, ...rest } = options;
  const key = normalizeCategoryKey(categoryKey);
  return useQuery({
    queryKey: qk.chungTuQuyetToan.bkmhHeaderSettings(key),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/bkmh-header-settings",
        method: "get",
        params: { categoryKey: key },
      }),
    enabled: Boolean(skip !== true && key.length > 0),
    ...rest,
  });
}

export function useUpsertChungTuBkmhHeaderSettingsMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ categoryKey, hoTenNguoiMua, boPhan }) =>
      apiRequest({
        url: "/chungtuquyettoan/bkmh-header-settings",
        method: "put",
        data: {
          categoryKey: normalizeCategoryKey(categoryKey),
          hoTenNguoiMua,
          boPhan,
        },
      }),
    onSuccess: (data, variables) => {
      invalidateChungTuBkmhHeaderSettings(qc, data?.categoryKey ?? variables?.categoryKey);
    },
  });
}

export function useChungTuPdfFieldCatalogQuery(options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.chungTuQuyetToan.pdfFieldCatalog(),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/pdf-template-field-catalog",
        method: "get",
      }),
    enabled: skip !== true,
    ...rest,
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

function openObjectUrlInNewWindow(objectUrl, targetWindow = null) {
  const openedWindow = targetWindow ?? window.open("about:blank", "_blank");
  if (!openedWindow) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Trình duyệt chặn cửa sổ mới.");
  }
  openedWindow.location.href = objectUrl;
  return openedWindow;
}

export async function openChungTuPdfTemplatePreview(templateId, options = {}) {
  const id = templateId != null ? String(templateId).trim() : "";
  const { targetWindow = null } = options ?? {};
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/pdf-templates/${encodeURIComponent(id)}/preview`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(pdfBlob);
  const openedWindow = openObjectUrlInNewWindow(objectUrl, targetWindow);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
  const cd = headers?.["content-disposition"] ?? headers?.["Content-Disposition"];
  return {
    openedWindow,
    objectUrl,
    fileName: filenameFromContentDisposition(cd) ?? `${id}-preview.pdf`,
  };
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

export async function downloadChungTuPdfBatchZip(batchKey) {
  const key = batchKey != null ? String(batchKey).trim() : "";
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/pdf-export-batches/${encodeURIComponent(key)}/zip`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const zipBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/zip" });
  const cd = headers?.["content-disposition"] ?? headers?.["Content-Disposition"];
  const fileName = filenameFromContentDisposition(cd) ?? `${key}.zip`;
  downloadBlobAsFile(zipBlob, fileName);
}

export async function downloadChungTuPdfBatchSummaryExcel(batchKey) {
  const key = batchKey != null ? String(batchKey).trim() : "";
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/pdf-export-batches/${encodeURIComponent(key)}/excel`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const excelBlob =
    blob instanceof Blob
      ? blob
      : new Blob([blob], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
  const cd = headers?.["content-disposition"] ?? headers?.["Content-Disposition"];
  const fileName = filenameFromContentDisposition(cd) ?? `${key}-tong-hop.xlsx`;
  downloadBlobAsFile(excelBlob, fileName);
}

export async function openChungTuPdfBatchMergedPdf(batchKey, options = {}) {
  const key = batchKey != null ? String(batchKey).trim() : "";
  const { targetWindow = null } = options ?? {};
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/pdf-export-batches/${encodeURIComponent(key)}/merged.pdf`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(pdfBlob);
  const openedWindow = openObjectUrlInNewWindow(objectUrl, targetWindow);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
  const cd = headers?.["content-disposition"] ?? headers?.["Content-Disposition"];
  return {
    openedWindow,
    objectUrl,
    fileName: filenameFromContentDisposition(cd) ?? `${key}-merged.pdf`,
  };
}

export async function openChungTuPdfBatchFile(batchKey, fileId, options = {}) {
  const batch = batchKey != null ? String(batchKey).trim() : "";
  const file = fileId != null ? String(fileId).trim() : "";
  const { targetWindow = null } = options ?? {};
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/pdf-export-batches/${encodeURIComponent(batch)}/files/${encodeURIComponent(file)}`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(pdfBlob);
  const openedWindow = openObjectUrlInNewWindow(objectUrl, targetWindow);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
  const cd = headers?.["content-disposition"] ?? headers?.["Content-Disposition"];
  return {
    openedWindow,
    objectUrl,
    fileName: filenameFromContentDisposition(cd) ?? `${batch}-${file}.pdf`,
  };
}

export async function downloadChungTuPdfBatchFile(batchKey, fileId, fileName) {
  const batch = batchKey != null ? String(batchKey).trim() : "";
  const file = fileId != null ? String(fileId).trim() : "";
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/pdf-export-batches/${encodeURIComponent(batch)}/files/${encodeURIComponent(file)}`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/pdf" });
  const cd = headers?.["content-disposition"] ?? headers?.["Content-Disposition"];
  downloadBlobAsFile(
    pdfBlob,
    fileName || filenameFromContentDisposition(cd) || `${batch}-${file}.pdf`,
  );
}
