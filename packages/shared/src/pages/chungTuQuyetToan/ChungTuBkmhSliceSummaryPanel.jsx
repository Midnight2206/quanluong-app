"use client";

import { Download, Eye, FileSpreadsheet, Loader2, Printer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import {
  CHUNG_TU_AGGREGATION_MODE_OPTIONS,
  CHUNG_TU_AGGREGATION_MODES,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import {
  downloadChungTuBkmhMonthlySliceFile,
  downloadChungTuBkmhMonthlySummaryExcel,
  downloadChungTuBkmhMonthlyZip,
  openChungTuBkmhMonthlyMergedPdf,
  openChungTuBkmhMonthlySliceFile,
  useChungTuBkmhMonthlyDetailQuery,
} from "@/features/chung-tu-quyet-toan/api/chungTuBkmhMonthlyApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { formatVnd } from "@/utils/formatVnd";
import { cn } from "@/utils/cn";
import { formatPeriodMonth } from "@/pages/chungTuQuyetToan/chungTuFormat";

function formatSliceDate(slice) {
  if (slice?.ngayThangNam) return slice.ngayThangNam;
  const value = String(slice?.periodDate ?? "").trim();
  return value ? value.slice(0, 10) : "—";
}

function formatAggregationModeLabel(value, labels) {
  return labels.get(value) || value || "—";
}

/**
 * @param {{
 *   monthlyId: string|number,
 *   aggregationMode?: string,
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 * }} props
 */
export function ChungTuBkmhSliceSummaryPanel({
  monthlyId,
  aggregationMode,
  open,
  onOpenChange,
}) {
  const [actionError, setActionError] = useState(null);
  const [busyActionKey, setBusyActionKey] = useState("");

  const { data: detail, isLoading } = useChungTuBkmhMonthlyDetailQuery(monthlyId, {
    skip: !open || !monthlyId,
  });

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
  }, [open, onOpenChange, monthlyId]);

  const aggregationLabels = useMemo(
    () => new Map(CHUNG_TU_AGGREGATION_MODE_OPTIONS.map((item) => [item.value, item.label])),
    [],
  );

  const resolvedAggregationMode = detail?.aggregationMode ?? aggregationMode;
  const showRecipientUnitColumn =
    aggregationMode === "by-unit" ||
    detail?.aggregationMode === "by-unit" ||
    resolvedAggregationMode === CHUNG_TU_AGGREGATION_MODES.BY_UNIT;
  const slices = Array.isArray(detail?.slices) ? detail.slices : [];
  const monthlyIdValue = detail?.id ?? monthlyId;

  const handleViewSlice = async (slice) => {
    setActionError(null);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      const message = "Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.";
      setActionError(message);
      notifyError(message);
      return;
    }
    setBusyActionKey(`view:${slice.id}`);
    try {
      await openChungTuBkmhMonthlySliceFile(monthlyIdValue, slice.id, {
        targetWindow: tab,
      });
    } catch (e) {
      tab.close();
      const message = e?.data?.message || e?.message || "Không mở được file PDF.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handleDownloadSlice = async (slice) => {
    setActionError(null);
    setBusyActionKey(`download:${slice.id}`);
    try {
      await downloadChungTuBkmhMonthlySliceFile(monthlyIdValue, slice.id, slice.fileName);
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không tải được file PDF.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handlePrintSlice = async (slice) => {
    setActionError(null);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      const message = "Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.";
      setActionError(message);
      notifyError(message);
      return;
    }
    setBusyActionKey(`print:${slice.id}`);
    try {
      const { openedWindow } = await openChungTuBkmhMonthlySliceFile(monthlyIdValue, slice.id, {
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
    setActionError(null);
    setBusyActionKey("zip");
    try {
      await downloadChungTuBkmhMonthlyZip(monthlyIdValue);
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không tải được file zip.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handleExportExcel = async () => {
    setActionError(null);
    setBusyActionKey("excel");
    try {
      await downloadChungTuBkmhMonthlySummaryExcel(monthlyIdValue);
      notifySuccess("Đã xuất Excel tổng hợp slice tháng này.");
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không xuất được file Excel.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handlePrintMerged = async () => {
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
      const { openedWindow } = await openChungTuBkmhMonthlyMergedPdf(monthlyIdValue, {
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

  if (!open) {
    return null;
  }

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
            <h2 className="text-sm font-semibold text-foreground">Tổng hợp slice BKMH</h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {detail?.displayName || "Xem các file PDF đã tạo cho tháng này."}
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
              <p className="text-[10px] uppercase text-muted-foreground">Tháng</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatPeriodMonth(detail?.periodMonth)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/25 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Chế độ gộp</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatAggregationModeLabel(resolvedAggregationMode, aggregationLabels)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/25 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Số slice</p>
              <p className="mt-0.5 font-medium text-foreground">{detail?.sliceCount ?? slices.length}</p>
            </div>
            <div className="rounded-lg bg-muted/25 px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground">Tổng tiền tháng</p>
              <p className="mt-0.5 font-medium text-foreground">{formatVnd(detail?.tongTienThang)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-1.5 text-xs"
              disabled={busyActionKey !== "" || isLoading || !monthlyIdValue || slices.length === 0}
              onClick={handleExportExcel}
            >
              {busyActionKey === "excel" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet className="size-3.5" aria-hidden />
              )}
              Xuất Excel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-1.5 text-xs"
              disabled={busyActionKey !== "" || isLoading || !monthlyIdValue}
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
              disabled={busyActionKey !== "" || isLoading || !monthlyIdValue}
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

          {isLoading ? (
            <div className="rounded-lg border border-border/60 bg-background px-3 py-8">
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Đang tải danh sách slice…
              </p>
            </div>
          ) : slices.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-background px-3 py-8">
              <p className="text-center text-sm text-muted-foreground">
                Chưa có slice PDF nào trong tháng này.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">Số CT</th>
                      <th className="px-3 py-2 font-semibold">Ngày tháng năm</th>
                      {showRecipientUnitColumn ? (
                        <th className="px-3 py-2 font-semibold">Tên đơn vị</th>
                      ) : null}
                      <th className="px-3 py-2 font-semibold">Tổng tiền</th>
                      <th className="px-3 py-2 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slices.map((slice) => (
                      <tr key={slice.id} className="border-b border-border/50 align-top last:border-b-0">
                        <td className="px-3 py-2.5 font-medium text-foreground">{slice.soChungTu || "—"}</td>
                        <td className="px-3 py-2.5 text-foreground">{formatSliceDate(slice)}</td>
                        {showRecipientUnitColumn ? (
                          <td className="px-3 py-2.5 text-foreground">{slice.recipientUnitName || "—"}</td>
                        ) : null}
                        <td className="px-3 py-2.5 text-foreground">{formatVnd(slice.tongTien)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs"
                              disabled={busyActionKey !== ""}
                              onClick={() => handleViewSlice(slice)}
                            >
                              {busyActionKey === `view:${slice.id}` ? (
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
                              disabled={busyActionKey !== ""}
                              onClick={() => handleDownloadSlice(slice)}
                            >
                              {busyActionKey === `download:${slice.id}` ? (
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
                              disabled={busyActionKey !== ""}
                              onClick={() => handlePrintSlice(slice)}
                            >
                              {busyActionKey === `print:${slice.id}` ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Printer className="size-3.5" aria-hidden />
                              )}
                              In
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
