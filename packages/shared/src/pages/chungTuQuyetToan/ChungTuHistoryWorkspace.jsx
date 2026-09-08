"use client";

import { Archive, Download, Eye, FolderOpen, Loader2, Printer, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { CHUNG_TU_AGGREGATION_MODE_OPTIONS } from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import {
  downloadChungTuBkmhMonthlyZip,
  openChungTuBkmhMonthlyMergedPdf,
  useChungTuBkmhMonthlyListQuery,
  useDeleteChungTuBkmhMonthlyMutation,
  useReExportBkmhMonthlyMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuBkmhMonthlyApi";
import {
  downloadChungTuPdfBatchFile,
  downloadChungTuPdfBatchZip,
  openChungTuPdfBatchMergedPdf,
  useChungTuPdfExportBatchesQuery,
  useChungTuPdfTemplatesQuery,
  useDeleteChungTuPdfExportBatchMutation,
  useReExportPdfBatchMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuPdfApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { formatPeriodLabel, formatPeriodMonth } from "@/pages/chungTuQuyetToan/chungTuFormat";
import { useChungTuUnitScope } from "@/pages/chungTuQuyetToan/useChungTuUnitScope";
import { ChungTuExportWizardCard } from "./ChungTuExportWizard";
import { ChungTuBkmhSliceSummaryPanel } from "./ChungTuBkmhSliceSummaryPanel.jsx";
import { ChungTuPnkBatchSummaryPanel } from "./ChungTuPnkBatchSummaryPanel.jsx";
import { ChungTuReExportDialog } from "./ChungTuReExportDialog.jsx";
import { formatVnd } from "@/utils/formatVnd";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

const exportTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatExportedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return exportTimeFormatter.format(date);
}

function getTemplateLabel(template) {
  if (!template) return "";
  const base = template.displayName || template.name || `Mẫu #${template.id}`;
  return template.version ? `${base} (v${template.version})` : base;
}

function formatCreatorLabel(item, currentUser) {
  const createdById = item?.createdById;
  if (createdById == null || createdById === "") return "—";
  if (String(currentUser?.id) === String(createdById)) {
    return currentUser?.fullName?.trim() || `ID ${createdById}`;
  }
  return `ID ${createdById}`;
}

/**
 * @param {{
 *   categoryKey: string,
 *   exportKind?: "monthly"|"by-slip"|"by-date",
 * }} props
 */
export function ChungTuHistoryWorkspace({ categoryKey, exportKind }) {
  // Cùng điều kiện vào trang CTQT: mọi acc đơn vị đều xuất lại/xóa được (không khóa theo người tạo).
  const canManageHistory = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_READ);
  const currentUser = useCurrentUser();
  const { confirm } = useConfirm();
  const { canPickUnits, unitsForDropdown, effectiveUnitId, persistManualUnitId } = useChungTuUnitScope();
  const [actionError, setActionError] = useState(null);
  const [busyActionKey, setBusyActionKey] = useState("");
  const [selectedMonthly, setSelectedMonthly] = useState(null);
  const [selectedPnkBatch, setSelectedPnkBatch] = useState(null);
  const [reExportTarget, setReExportTarget] = useState(null);
  const isBkmhCategory = categoryKey === "bang-ke-mua-hang";
  const isPnkCategory = categoryKey === "phieu-nhap-kho";
  const isPxkCategory = categoryKey === "phieu-xuat-kho";
  const isFolderSummaryCategory = isPnkCategory || isPxkCategory;

  const { data: monthlyRows = [], isLoading: monthlyLoading } = useChungTuBkmhMonthlyListQuery(
    { storageUnitId: effectiveUnitId },
    { skip: !isBkmhCategory || !effectiveUnitId },
  );
  const { data: pdfExportBatches = [], isLoading: exportsLoading } = useChungTuPdfExportBatchesQuery(
    { unitId: effectiveUnitId, categoryKey },
    { skip: isBkmhCategory || !effectiveUnitId },
  );
  const { data: templates = [] } = useChungTuPdfTemplatesQuery(categoryKey, {
    skip: !categoryKey,
  });

  const [deleteBkmhMonthly, { isLoading: deletingBkmhMonthly }] = useDeleteChungTuBkmhMonthlyMutation();
  const [deletePdfExportBatch, { isLoading: deletingExportBatch }] =
    useDeleteChungTuPdfExportBatchMutation();
  const [reExportPdfBatch, { isLoading: reExportingBatch }] = useReExportPdfBatchMutation();
  const [reExportBkmhMonthly, { isLoading: reExportingBkmh }] = useReExportBkmhMonthlyMutation();
  const reExportBusy = reExportingBatch || reExportingBkmh;
  const templateLabelById = useMemo(
    () =>
      new Map(
        templates.map((template) => [String(template.id), getTemplateLabel(template)]),
      ),
    [templates],
  );
  const aggregationLabelByValue = useMemo(
    () => new Map(CHUNG_TU_AGGREGATION_MODE_OPTIONS.map((item) => [item.value, item.label])),
    [],
  );

  const handleDownloadZip = async (item) => {
    setActionError(null);
    setBusyActionKey(`zip:${item.batchKey}`);
    try {
      await downloadChungTuPdfBatchZip(item.batchKey);
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không tải được file zip.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handlePrintBatch = async (item) => {
    setActionError(null);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      const message = "Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.";
      setActionError(message);
      notifyError(message);
      return;
    }
    setBusyActionKey(`print:${item.batchKey}`);
    try {
      const { openedWindow } = await openChungTuPdfBatchMergedPdf(item.batchKey, {
        targetWindow: tab,
      });
      setTimeout(() => {
        try {
          openedWindow.focus?.();
          openedWindow.print?.();
        } catch {
          // ponytail: fallback is browser print shortcut if auto print fails on some viewers.
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

  const handleDownloadMonthlyZip = async (item) => {
    setActionError(null);
    setBusyActionKey(`zip:${item.id}`);
    try {
      await downloadChungTuBkmhMonthlyZip(item.id);
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không tải được file zip.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handlePrintMonthly = async (item) => {
    setActionError(null);
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      const message = "Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.";
      setActionError(message);
      notifyError(message);
      return;
    }
    setBusyActionKey(`print:${item.id}`);
    try {
      const { openedWindow } = await openChungTuBkmhMonthlyMergedPdf(item.id, {
        targetWindow: tab,
      });
      setTimeout(() => {
        try {
          openedWindow.focus?.();
          openedWindow.print?.();
        } catch {
          // ponytail: fallback is browser print shortcut if auto print fails on some viewers.
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

  const handleDownloadFile = async (item, file) => {
    setActionError(null);
    setBusyActionKey(`file:${item.batchKey}:${file.fileId}`);
    try {
      await downloadChungTuPdfBatchFile(item.batchKey, file.fileId, file.fileName);
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không tải được file PDF.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handleDeleteBatch = async (item) => {
    const ok = await confirm({
      title: "Xóa folder PDF?",
      message: "Folder PDF này sẽ bị xóa khỏi lịch sử đã xuất.",
      confirmLabel: "Xóa",
      variant: "danger",
    });
    if (!ok) return;
    setActionError(null);
    try {
      setBusyActionKey(`delete:${item.batchKey}`);
      await deletePdfExportBatch({
        batchKey: item.batchKey,
        unitId: effectiveUnitId,
        categoryKey,
      }).unwrap();
      if (String(selectedPnkBatch?.batchKey) === String(item.batchKey)) {
        setSelectedPnkBatch(null);
      }
      notifySuccess("Đã xóa folder PDF.");
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không xóa được folder PDF.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const handleReExportSubmit = async ({ pdfTemplateId, refreshData }) => {
    if (!reExportTarget) return;
    setActionError(null);
    try {
      if (reExportTarget.kind === "bkmh") {
        await reExportBkmhMonthly({
          id: reExportTarget.id,
          pdfTemplateId,
          refreshData,
          storageUnitId: effectiveUnitId,
          periodMonth: reExportTarget.periodMonth,
        }).unwrap();
      } else {
        await reExportPdfBatch({
          batchKey: reExportTarget.batchKey,
          pdfTemplateId,
          refreshData,
          unitId: effectiveUnitId,
          categoryKey,
        }).unwrap();
      }
      notifySuccess("Đã xuất lại chứng từ.");
      setReExportTarget(null);
    } catch (e) {
      const message = e?.data?.message || e?.message || "Xuất lại thất bại.";
      setActionError(message);
      notifyError(message);
      throw e;
    }
  };

  const handleDeleteMonthly = async (item) => {
    const ok = await confirm({
      title: "Xóa lịch sử tháng BKMH?",
      message: "Tháng BKMH này sẽ bị xóa khỏi lịch sử đã lưu.",
      confirmLabel: "Xóa",
      variant: "danger",
    });
    if (!ok) return;
    setActionError(null);
    try {
      setBusyActionKey(`delete:${item.id}`);
      await deleteBkmhMonthly({
        id: item.id,
        storageUnitId: effectiveUnitId,
        periodMonth: item.periodMonth,
      }).unwrap();
      if (String(selectedMonthly?.id) === String(item.id)) {
        setSelectedMonthly(null);
      }
      notifySuccess("Đã xóa lịch sử BKMH tháng.");
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không xóa được lịch sử BKMH tháng.";
      setActionError(message);
      notifyError(message);
    } finally {
      setBusyActionKey("");
    }
  };

  const expandedLayout = true;

  return (
    <>
      <div
        className={cn(
          "space-y-3",
          expandedLayout ? "px-0 py-3 sm:p-4" : "p-3 sm:p-4",
        )}
      >
        {canPickUnits && unitsForDropdown.length > 0 && effectiveUnitId != null ? (
          <ChungTuExportWizardCard
            title="Bộ lọc"
            description="Chọn kho LTTP để xem chứng từ đã lưu."
            expanded={expandedLayout}
          >
            <label className="block min-w-0 space-y-1" htmlFor={`ct-history-unit-${categoryKey}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Đơn vị kho LTTP
              </span>
              <select
                id={`ct-history-unit-${categoryKey}`}
                className={fieldClass}
                value={String(effectiveUnitId ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  persistManualUnitId(v === "" ? null : Number(v));
                }}
              >
                {unitsForDropdown.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? `Đơn vị #${u.id}`}
                  </option>
                ))}
              </select>
            </label>
          </ChungTuExportWizardCard>
        ) : null}

        {actionError ? (
          <p
            className={cn(
              "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
              expandedLayout && "mx-0 rounded-none border-x-0 sm:mx-0 sm:rounded-lg sm:border-x",
            )}
          >
            {actionError}
          </p>
        ) : null}

        {isBkmhCategory ? (
          monthlyLoading ? (
            <ChungTuExportWizardCard
              title="Lịch sử BKMH theo tháng"
              expanded={expandedLayout}
              bodyClassName="py-6"
            >
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Đang tải lịch sử…
              </p>
            </ChungTuExportWizardCard>
          ) : monthlyRows.length === 0 ? (
            <ChungTuExportWizardCard
              title="Lịch sử BKMH theo tháng"
              expanded={expandedLayout}
              bodyClassName="py-6"
            >
              <p className="text-center text-sm text-muted-foreground">
                Chưa có tháng BKMH nào cho đơn vị này.
              </p>
            </ChungTuExportWizardCard>
          ) : (
            <ChungTuExportWizardCard
              title={`Lịch sử BKMH theo tháng (${monthlyRows.length})`}
              description="Mỗi thẻ là một tháng đã xuất; có thể in gộp, tải zip hoặc mở tổng hợp slice."
              expanded={expandedLayout}
              bodyClassName="space-y-3"
            >
              {monthlyRows.map((item) => {
                const creatorLabel = formatCreatorLabel(item, currentUser);
                return (
                  <div key={item.id} className="space-y-3 rounded-xl border border-border/70 bg-card/30 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="flex items-center gap-2 text-sm font-semibold leading-snug text-foreground">
                          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{item.displayName || `BKMH ${formatPeriodMonth(item.periodMonth)}`}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.sliceCount ?? 0} chứng từ · {formatVnd(item.tongTienThang)}
                        </p>
                      </div>
                      <p className="text-right text-[11px] text-muted-foreground">
                        {formatExportedAt(item.updatedAt || item.createdAt)}
                      </p>
                    </div>

                    <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg bg-muted/25 px-2.5 py-2">
                        <dt className="text-[10px] uppercase text-muted-foreground">Tháng</dt>
                        <dd className="mt-0.5 font-medium text-foreground">
                          {formatPeriodMonth(item.periodMonth)}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-muted/25 px-2.5 py-2">
                        <dt className="text-[10px] uppercase text-muted-foreground">Chế độ gộp</dt>
                        <dd className="mt-0.5 font-medium text-foreground">
                          {aggregationLabelByValue.get(item.aggregationMode) || item.aggregationMode || "—"}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-muted/25 px-2.5 py-2">
                        <dt className="text-[10px] uppercase text-muted-foreground">Số slice</dt>
                        <dd className="mt-0.5 font-medium text-foreground">{item.sliceCount ?? 0}</dd>
                      </div>
                      <div className="rounded-lg bg-muted/25 px-2.5 py-2">
                        <dt className="text-[10px] uppercase text-muted-foreground">Người tạo</dt>
                        <dd className="mt-0.5 font-medium text-foreground">{creatorLabel}</dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 gap-1.5 text-xs"
                        disabled={busyActionKey !== "" || deletingBkmhMonthly}
                        onClick={() => handlePrintMonthly(item)}
                      >
                        {busyActionKey === `print:${item.id}` ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Printer className="size-3.5" aria-hidden />
                        )}
                        In tất cả
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 gap-1.5 text-xs"
                        disabled={busyActionKey !== "" || deletingBkmhMonthly}
                        onClick={() => handleDownloadMonthlyZip(item)}
                      >
                        {busyActionKey === `zip:${item.id}` ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Archive className="size-3.5" aria-hidden />
                        )}
                        Tải zip
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 gap-1.5 text-xs"
                        disabled={busyActionKey !== "" || deletingBkmhMonthly}
                        onClick={() =>
                          setSelectedMonthly({
                            id: item.id,
                            aggregationMode: item.aggregationMode,
                          })
                        }
                      >
                        <Eye className="size-3.5" aria-hidden />
                        Xem tổng hợp
                      </Button>
                      {canManageHistory ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-10 gap-1.5 text-xs"
                          disabled={busyActionKey !== "" || deletingBkmhMonthly || reExportBusy}
                          onClick={() =>
                            setReExportTarget({
                              kind: "bkmh",
                              id: item.id,
                              periodMonth: item.periodMonth,
                              pdfTemplateId: item.pdfTemplateId,
                            })
                          }
                        >
                          <RefreshCw className="size-3.5" aria-hidden />
                          Xuất lại
                        </Button>
                      ) : null}
                      {canManageHistory ? (
                        <Button
                          type="button"
                          variant="dangerGhost"
                          className="h-10 gap-1.5 text-xs"
                          disabled={busyActionKey !== "" || deletingBkmhMonthly}
                          onClick={() => handleDeleteMonthly(item)}
                        >
                          {busyActionKey === `delete:${item.id}` ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="size-3.5" aria-hidden />
                          )}
                          Xóa
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </ChungTuExportWizardCard>
          )
        ) : exportsLoading ? (
          <ChungTuExportWizardCard
            title="Lịch sử folder PDF"
            expanded={expandedLayout}
            bodyClassName="py-6"
          >
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Đang tải lịch sử…
            </p>
          </ChungTuExportWizardCard>
        ) : pdfExportBatches.length === 0 ? (
          <ChungTuExportWizardCard
            title="Lịch sử folder PDF"
            expanded={expandedLayout}
            bodyClassName="py-6"
          >
            <p className="text-center text-sm text-muted-foreground">
              Chưa có folder PDF nào cho đơn vị này.
            </p>
          </ChungTuExportWizardCard>
        ) : (
          <ChungTuExportWizardCard
            title={`Lịch sử folder PDF (${pdfExportBatches.length})`}
            description={
              isFolderSummaryCategory
                ? "Mỗi thẻ là một folder đã xuất; có thể in gộp, tải zip hoặc mở tổng hợp file."
                : "Mỗi lần xuất tạo một folder; mở từng folder để tải zip, in gộp hoặc tải file lẻ."
            }
            expanded={expandedLayout}
            bodyClassName="space-y-3"
          >
            {pdfExportBatches.map((item) => {
              const creatorLabel = formatCreatorLabel(item, currentUser);
              const templateLabel =
                templateLabelById.get(String(item.pdfTemplateId ?? "")) ||
                (item.pdfTemplateId != null ? `Mẫu #${item.pdfTemplateId}` : "—");
              const batchHeader = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold leading-snug text-foreground">
                        <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{item.displayName || item.batchKey || templateLabel}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {isFolderSummaryCategory
                          ? `${item.fileCount ?? 0} file · ${formatVnd(item.tongTienFolder)}`
                          : `${item.fileCount ?? 0} file · ${templateLabel}`}
                      </p>
                    </div>
                    <p className="text-right text-[11px] text-muted-foreground">
                      {formatExportedAt(item.createdAt)}
                    </p>
                  </div>

                  <dl className={cn("grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4", !isFolderSummaryCategory && "mt-3")}>
                    <div className="rounded-lg bg-muted/25 px-2.5 py-2">
                      <dt className="text-[10px] uppercase text-muted-foreground">Kỳ</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {formatPeriodLabel(item, exportKind)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-muted/25 px-2.5 py-2">
                      <dt className="text-[10px] uppercase text-muted-foreground">Mẫu</dt>
                      <dd className="mt-0.5 font-medium leading-snug text-foreground">{templateLabel}</dd>
                    </div>
                    <div className="rounded-lg bg-muted/25 px-2.5 py-2">
                      <dt className="text-[10px] uppercase text-muted-foreground">Người tạo</dt>
                      <dd className="mt-0.5 font-medium text-foreground">{creatorLabel}</dd>
                    </div>
                    <div className="rounded-lg bg-muted/25 px-2.5 py-2">
                      <dt className="text-[10px] uppercase text-muted-foreground">Chế độ gộp</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {aggregationLabelByValue.get(item.aggregationMode) || item.aggregationMode || "—"}
                      </dd>
                    </div>
                  </dl>
                </>
              );

              if (isFolderSummaryCategory) {
                return (
                  <div key={item.batchKey} className="space-y-3 rounded-xl border border-border/70 bg-card/30 p-3 sm:p-4">
                    {batchHeader}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 gap-1.5 text-xs"
                        disabled={busyActionKey !== "" || deletingExportBatch}
                        onClick={() => handlePrintBatch(item)}
                      >
                        {busyActionKey === `print:${item.batchKey}` ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Printer className="size-3.5" aria-hidden />
                        )}
                        In tất cả
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 gap-1.5 text-xs"
                        disabled={busyActionKey !== "" || deletingExportBatch}
                        onClick={() => handleDownloadZip(item)}
                      >
                        {busyActionKey === `zip:${item.batchKey}` ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Archive className="size-3.5" aria-hidden />
                        )}
                        Tải zip
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 gap-1.5 text-xs"
                        disabled={busyActionKey !== "" || deletingExportBatch}
                        onClick={() => setSelectedPnkBatch(item)}
                      >
                        <Eye className="size-3.5" aria-hidden />
                        Xem tổng hợp
                      </Button>
                      {canManageHistory ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-10 gap-1.5 text-xs"
                          disabled={busyActionKey !== "" || deletingExportBatch || reExportBusy}
                          onClick={() =>
                            setReExportTarget({
                              kind: "batch",
                              batchKey: item.batchKey,
                              pdfTemplateId: item.pdfTemplateId,
                            })
                          }
                        >
                          <RefreshCw className="size-3.5" aria-hidden />
                          Xuất lại
                        </Button>
                      ) : null}
                      {canManageHistory ? (
                        <Button
                          type="button"
                          variant="dangerGhost"
                          className="h-10 gap-1.5 text-xs"
                          disabled={busyActionKey !== "" || deletingExportBatch}
                          onClick={() => handleDeleteBatch(item)}
                        >
                          {busyActionKey === `delete:${item.batchKey}` ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="size-3.5" aria-hidden />
                          )}
                          Xóa
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              }

              return (
                <details
                  key={item.batchKey}
                  className="rounded-xl border border-border/70 bg-card/30"
                >
                  <summary className="cursor-pointer list-none px-3 py-3 sm:px-4">
                    {batchHeader}
                  </summary>

                  <div className="space-y-3 border-t border-border/70 px-3 py-3 sm:px-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 gap-1.5 text-xs"
                        disabled={busyActionKey !== "" || deletingExportBatch}
                        onClick={() => handleDownloadZip(item)}
                      >
                        {busyActionKey === `zip:${item.batchKey}` ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Archive className="size-3.5" aria-hidden />
                        )}
                        Tải zip
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 gap-1.5 text-xs"
                        disabled={busyActionKey !== "" || deletingExportBatch}
                        onClick={() => handlePrintBatch(item)}
                      >
                        {busyActionKey === `print:${item.batchKey}` ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Printer className="size-3.5" aria-hidden />
                        )}
                        In tất cả
                      </Button>
                      {canManageHistory ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-10 gap-1.5 text-xs"
                          disabled={busyActionKey !== "" || deletingExportBatch || reExportBusy}
                          onClick={() =>
                            setReExportTarget({
                              kind: "batch",
                              batchKey: item.batchKey,
                              pdfTemplateId: item.pdfTemplateId,
                            })
                          }
                        >
                          <RefreshCw className="size-3.5" aria-hidden />
                          Xuất lại
                        </Button>
                      ) : null}
                      {canManageHistory ? (
                        <Button
                          type="button"
                          variant="dangerGhost"
                          className="h-10 gap-1.5 text-xs"
                          disabled={busyActionKey !== "" || deletingExportBatch}
                          onClick={() => handleDeleteBatch(item)}
                        >
                          {busyActionKey === `delete:${item.batchKey}` ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="size-3.5" aria-hidden />
                          )}
                          Xóa batch
                        </Button>
                      ) : null}
                    </div>

                    {!isBkmhCategory && !isFolderSummaryCategory ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                          File trong folder
                        </p>
                        {Array.isArray(item.files) && item.files.length > 0 ? (
                          item.files.map((file) => (
                            <div
                              key={file.fileId || file.exportKey}
                              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {file.fileName || "PDF"}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {file.sortKey || file.exportKey || "Không có sort key"}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 gap-1.5 text-xs sm:self-auto"
                                disabled={busyActionKey !== "" || deletingExportBatch}
                                onClick={() => handleDownloadFile(item, file)}
                              >
                                {busyActionKey === `file:${item.batchKey}:${file.fileId}` ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Download className="size-3.5" aria-hidden />
                                )}
                                Tải file
                              </Button>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-lg border border-border/60 bg-background px-3 py-3 text-xs text-muted-foreground">
                            Folder này chưa có file PDF nào.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </ChungTuExportWizardCard>
        )}
      </div>
      {isBkmhCategory ? (
        <ChungTuBkmhSliceSummaryPanel
          monthlyId={selectedMonthly?.id ?? ""}
          aggregationMode={selectedMonthly?.aggregationMode ?? ""}
          open={Boolean(selectedMonthly)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedMonthly(null);
            }
          }}
        />
      ) : null}
      {isFolderSummaryCategory ? (
        <ChungTuPnkBatchSummaryPanel
          batch={selectedPnkBatch}
          open={Boolean(selectedPnkBatch)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPnkBatch(null);
            }
          }}
        />
      ) : null}
      <ChungTuReExportDialog
        open={Boolean(reExportTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setReExportTarget(null);
          }
        }}
        templates={templates}
        defaultTemplateId={reExportTarget?.pdfTemplateId ?? null}
        submitting={reExportBusy}
        onSubmit={handleReExportSubmit}
      />
    </>
  );
}
