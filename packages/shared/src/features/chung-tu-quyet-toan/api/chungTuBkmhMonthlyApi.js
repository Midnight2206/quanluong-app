"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { useWrappedMutation } from "@/lib/useWrappedMutation";
import { apiRequest } from "@/services/apiRequest";
import { downloadBlobAsFile } from "@/utils/captureElementToPngCore";

function invalidateChungTuBkmhMonthly(qc, storageUnitId, periodMonth) {
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.bkmhMonthly(storageUnitId, periodMonth) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.bkmhMonthly(storageUnitId) });
  qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.root });
}

function invalidateChungTuBkmhMonthlyDetail(qc, id) {
  if (id != null && String(id).trim() !== "") {
    qc.invalidateQueries({ queryKey: qk.chungTuQuyetToan.bkmhMonthlyDetail(id) });
  }
}

export function useChungTuBkmhMonthlyListQuery({ storageUnitId, periodMonth } = {}, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.chungTuQuyetToan.bkmhMonthly(storageUnitId, periodMonth),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/bkmh-monthly",
        method: "get",
        params: {
          storageUnitId,
          ...(periodMonth ? { periodMonth } : {}),
        },
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
    enabled: Boolean(skip !== true && storageUnitId != null && storageUnitId !== ""),
    ...rest,
  });
}

export function useChungTuBkmhMonthlyDetailQuery(id, options = {}) {
  const { skip, ...rest } = options;
  const monthlyId = id != null ? String(id).trim() : "";
  return useQuery({
    queryKey: qk.chungTuQuyetToan.bkmhMonthlyDetail(monthlyId),
    queryFn: () =>
      apiRequest({
        url: `/chungtuquyettoan/bkmh-monthly/${encodeURIComponent(monthlyId)}`,
        method: "get",
      }),
    enabled: Boolean(skip !== true && monthlyId.length > 0),
    ...rest,
  });
}

export function useCreateChungTuBkmhMonthlyExportMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) =>
      apiRequest({
        url: "/chungtuquyettoan/bkmh-monthly-exports",
        method: "post",
        data: body,
      }),
    onSuccess: (data, variables) => {
      invalidateChungTuBkmhMonthly(
        qc,
        data?.storageUnitId ?? variables?.unitId,
        data?.periodMonth ?? variables?.periodMonth,
      );
      invalidateChungTuBkmhMonthlyDetail(qc, data?.id);
    },
  });
}

export function useDeleteChungTuBkmhMonthlyMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id }) =>
      apiRequest({
        url: `/chungtuquyettoan/bkmh-monthly/${encodeURIComponent(id)}`,
        method: "delete",
      }),
    onSuccess: (_data, variables) => {
      invalidateChungTuBkmhMonthly(qc, variables?.storageUnitId, variables?.periodMonth);
      invalidateChungTuBkmhMonthlyDetail(qc, variables?.id);
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

function openObjectUrlInNewWindow(objectUrl, targetWindow = null) {
  const openedWindow = targetWindow ?? window.open("about:blank", "_blank");
  if (!openedWindow) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Trình duyệt chặn cửa sổ mới.");
  }
  openedWindow.location.href = objectUrl;
  return openedWindow;
}

export async function downloadChungTuBkmhMonthlyZip(id) {
  const monthlyId = id != null ? String(id).trim() : "";
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/bkmh-monthly/${encodeURIComponent(monthlyId)}/zip`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const zipBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/zip" });
  const cd = headers?.["content-disposition"] ?? headers?.["Content-Disposition"];
  const fileName = filenameFromContentDisposition(cd) ?? `${monthlyId}.zip`;
  downloadBlobAsFile(zipBlob, fileName);
}

export async function openChungTuBkmhMonthlyMergedPdf(id, options = {}) {
  const monthlyId = id != null ? String(id).trim() : "";
  const { targetWindow = null } = options ?? {};
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/bkmh-monthly/${encodeURIComponent(monthlyId)}/merged.pdf`,
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
    fileName: filenameFromContentDisposition(cd) ?? `${monthlyId}-merged.pdf`,
  };
}

export async function downloadChungTuBkmhMonthlySliceFile(id, sliceId, fileName) {
  const monthlyId = id != null ? String(id).trim() : "";
  const slice = sliceId != null ? String(sliceId).trim() : "";
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/bkmh-monthly/${encodeURIComponent(monthlyId)}/slices/${encodeURIComponent(slice)}/file`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/pdf" });
  const cd = headers?.["content-disposition"] ?? headers?.["Content-Disposition"];
  downloadBlobAsFile(
    pdfBlob,
    fileName || filenameFromContentDisposition(cd) || `${monthlyId}-${slice}.pdf`,
  );
}

export async function openChungTuBkmhMonthlySliceFile(id, sliceId, options = {}) {
  const monthlyId = id != null ? String(id).trim() : "";
  const slice = sliceId != null ? String(sliceId).trim() : "";
  const { targetWindow = null } = options ?? {};
  const { data: blob, headers } = await apiRequest({
    url: `/chungtuquyettoan/bkmh-monthly/${encodeURIComponent(monthlyId)}/slices/${encodeURIComponent(slice)}/file`,
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
    fileName: filenameFromContentDisposition(cd) ?? `${monthlyId}-${slice}.pdf`,
  };
}
