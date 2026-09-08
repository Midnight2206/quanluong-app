"use client";

import { Download, Eye, Loader2, Printer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import {
  CHUNG_TU_AGGREGATION_MODES,
  CHUNG_TU_AGGREGATION_MODE_OPTIONS,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import {
  downloadChungTuPdfBatchFile,
  downloadChungTuPdfBatchZip,
  openChungTuPdfBatchFile,
  openChungTuPdfBatchMergedPdf,
} from "@/features/chung-tu-quyet-toan/api/chungTuPdfApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { formatVnd } from "@/utils/formatVnd";
import { cn } from "@/utils/cn";
import { formatPeriodMonth } from "@/pages/chungTuQuyetToan/chungTuFormat";

function formatBatchPeriodLabel(batch) {
  if (batch?.periodMonth) {
    return formatPeriodMonth(batch.periodMonth);
  }
  const displayName = String(batch?.displayName ?? "").trim();
  const separatorIndex = displayName.lastIndexOf(" - ");
  if (separatorIndex >= 0) {
    return displayName.slice(separatorIndex + 3).trim() || "—";
  }
  return batch?.periodDate?.slice?.(0, 10) || "—";
}

function formatFileDate(file) {
  if (file?.ngayThangNam) return file.ngayThangNam;
  return file?.periodDate?.slice?.(0, 10) || "—";
}

function formatAggregationModeLabel(value, labels) {
  return labels.get(value) || value || "—";
}

/**
 * @param {{
 *   batch: {
 *     batchKey?: string,
 *     displayName?: string,
 *     periodMonth?: string|null,
 *     periodDate?: string|null,
 *     aggregationMode?: string|null,
 *     fileCount?: number|null,
 *     tongTienFolder?: number|null,
 *     mergedPdfPath?: string|null,
 *     zipPath?: string|null,
 *     files?: Array<{
 *       id?: string|number,
 *       fileId?: string|number|null,
 *       fileName?: string|null,
 *       downloadPath?: string|null,
 *       soChungTu?: string|null,
 *       ngayThangNam?: string|null,
 *       periodDate?: string|null,
 *       recipientUnitName?: string|null,
 *       tongTien?: number|null,
 *     }>,
 *   }|null,
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 * }} props
 */
export function ChungTuPnkBatchSummaryPanel({ batch, open, onOpenChange }) {
  const [actionError, setActionError] = useState(null);
  const [busyActionKey, setBusyActionKey] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    setActionError(null);
    setBusyActionKey("");

    function onKeyDown(event) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const aggregationLabels = useMemo(
    () => new Map(CHUNG_TU_AGGREGATION_MODE_OPTIONS.map((item) => [item.value, item.label])),
    [],
  );

  if (!open || !batch) {
    return null;
  }

  const batchKey = String(batch.batchKey ?? "").trim();
  const files = Array.isArray(batch.files) ? batch.files : [];
  const showRecipientUnitColumn = batch.aggregationMode === CHUNG_TU_AGGREGATION_MODES.BY_UNIT;

  const handleViewFile = async (file) => {
    if (!batchKey || file?.fileId == null) return;
    setActionError(null);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      const message = "Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.";
      setActionError(message);
      notifyError(message);
      return;
    }
    setBusyActionKey(`view:${file.fileId}`);
    try {
      await openChungTuPdfBatchFile(batchKey, file.fileId, { targetWindow: tab });
    } catch (e) {
      tab.close();
      const message = e?.data?.message || e?.message || "Không mở được file PDF.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handleDownloadFile = async (file) => {
    if (!batchKey || file?.fileId == null) return;
    setActionError(null);
    setBusyActionKey(`download:${file.fileId}`);
    try {
      await downloadChungTuPdfBatchFile(batchKey, file.fileId, file.fileName);
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không tải được file PDF.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handlePrintFile = async (file) => {
    if (!batchKey || file?.fileId == null) return;
    setActionError(null);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      const message = "Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.";
      setActionError(message);
      notifyError(message);
      return;
    }
    setBusyActionKey(`print:${file.fileId}`);
    try {
      const { openedWindow } = await openChungTuPdfBatchFile(batchKey, file.fileId, {
        targetWindow: tab,
      });
      setTimeout(() => {
        try {
          openedWindow.focus?.();
          openedWindow.print?.();
        } catch {
          // ponytail: browser PDF viewers vary; manual Ctrl/Cmd+P remains the fallback.
        }
      }, 700);
      notifySuccess("Đã mở PDF. Nếu hộp thoại in chưa hiện, dùng Ctrl/Cmd+P.");
    } catch (e) {
      tab.close();
      const message = e?.data?.message || e?.message || "Không mở được file PDF.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handleDownloadZip = async () => {
    if (!batchKey) return;
    setActionError(null);
    setBusyActionKey("zip");
    try {
      await downloadChungTuPdfBatchZip(batchKey);
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không tải được file zip.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handlePrintMerged = async () => {
    if (!batchKey) return;
    setActionError(null);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      const message = "Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.";
      setActionError(message);
      notifyError(message);
      return;
    }
    setBusyActionKey("print-all");
    try {
      const { openedWindow } = await openChungTuPdfBatchMergedPdf(batchKey, {
        targetWindow: tab,
      });
      setTimeout(() => {
        try {
          openedWindow.focus?.();
          openedWindow.print?.();
        } catch {
          // ponytail: browser PDF viewers vary; manual Ctrl/Cmd+P remains the fallback.
        }
      }, 700);
      notifySuccess("Đã mở PDF gộp. Nếu hộp thoại in chưa hiện, dùng Ctrl/Cmd+P.");
    } catch (e) {
      tab.close();
      const message = e?.data?.message || e?.message || "Không mở được PDF gộp.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Đóng"
        onClick={() => onOpenChange(false)}
      />

      <div
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-lg sm:rounded-2xl",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Tổng hợp folder PNK</h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {batch.displayName || "Xem các file PDF đã tạo trong folder này."}
            </p>
          </div>
          <IconButton label="Đóng" variant="ghost" className="shrink-0" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </header>

        <div data-local-scroll="true" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
          {actionError ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {actionError}
            </p>
          ) : null}

          <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-muted/25 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Folder</p>
              <p className="mt-0.5 font-medium text-foreground">{batch.displayName || batchKey || "—"}</p>
            </div>
            <div className="rounded-lg bg-muted/25 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Kỳ</p>
              <p className="mt-0.5 font-medium text-foreground">{formatBatchPeriodLabel(batch)}</p>
            </div>
            <div className="rounded-lg bg-muted/25 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Chế độ gộp</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatAggregationModeLabel(batch.aggregationMode, aggregationLabels)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/25 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Tổng tiền folder</p>
              <p className="mt-0.5 font-medium text-foreground">{formatVnd(batch.tongTienFolder)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-1.5 text-xs"
              disabled={busyActionKey !== "" || !batchKey}
              onClick={handleDownloadZip}
            >
              {busyActionKey === "zip" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Download className="size-3.5" aria-hidden />
              )}
              Tải zip
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-1.5 text-xs"
              disabled={busyActionKey !== "" || !batchKey}
              onClick={handlePrintMerged}
            >
              {busyActionKey === "print-all" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Printer className="size-3.5" aria-hidden />
              )}
              In tất cả
            </Button>
          </div>

          {files.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-background px-3 py-8">
              <p className="text-center text-sm text-muted-foreground">
                Folder này chưa có file PDF nào.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">Số CT</th>
                      <th className="px-3 py-2 font-semibold">Ngày</th>
                      {showRecipientUnitColumn ? (
                        <th className="px-3 py-2 font-semibold">Đơn vị</th>
                      ) : null}
                      <th className="px-3 py-2 font-semibold">Tổng tiền</th>
                      <th className="px-3 py-2 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, index) => {
                      const rowKey = file.fileId || file.id || file.downloadPath || `${batchKey}-${index}`;
                      const disabled = busyActionKey !== "" || file.fileId == null;
                      return (
                        <tr key={rowKey} className="border-b border-border/50 align-top last:border-b-0">
                          <td className="px-3 py-2.5 font-medium text-foreground">{file.soChungTu || "—"}</td>
                          <td className="px-3 py-2.5 text-foreground">{formatFileDate(file)}</td>
                          {showRecipientUnitColumn ? (
                            <td className="px-3 py-2.5 text-foreground">{file.recipientUnitName || "—"}</td>
                          ) : null}
                          <td className="px-3 py-2.5 text-foreground">{formatVnd(file.tongTien)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs"
                                disabled={disabled}
                                onClick={() => handleViewFile(file)}
                              >
                                {busyActionKey === `view:${file.fileId}` ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Eye className="size-3.5" aria-hidden />
                                )}
                                Xem
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs"
                                disabled={disabled}
                                onClick={() => handleDownloadFile(file)}
                              >
                                {busyActionKey === `download:${file.fileId}` ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Download className="size-3.5" aria-hidden />
                                )}
                                Tải
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs"
                                disabled={disabled}
                                onClick={() => handlePrintFile(file)}
                              >
                                {busyActionKey === `print:${file.fileId}` ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Printer className="size-3.5" aria-hidden />
                                )}
                                In
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
