"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { cn } from "@/utils/cn";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import {
  downloadChungTuPdfExport,
  useChungTuPdfExportsQuery,
  useChungTuPdfTemplatesQuery,
  useDeleteChungTuPdfExportMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuPdfApi";
import { formatPeriodLabel } from "@/pages/chungTuQuyetToan/chungTuFormat";
import { useChungTuUnitScope } from "@/pages/chungTuQuyetToan/useChungTuUnitScope";
import { ChungTuExportWizardCard } from "./ChungTuExportWizard";

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
  const canWrite = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_WRITE);
  const currentUser = useCurrentUser();
  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const { canPickUnits, unitsForDropdown, effectiveUnitId, persistManualUnitId } = useChungTuUnitScope();
  const [actionError, setActionError] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState("");

  const { data: pdfExports = [], isLoading: exportsLoading } = useChungTuPdfExportsQuery(
    { unitId: effectiveUnitId, categoryKey },
    { skip: !effectiveUnitId },
  );
  const { data: templates = [] } = useChungTuPdfTemplatesQuery(categoryKey, { skip: !categoryKey });

  const [deletePdfExport, { isLoading: deletingExport }] = useDeleteChungTuPdfExportMutation();
  const templateLabelById = useMemo(
    () =>
      new Map(
        templates.map((template) => [String(template.id), getTemplateLabel(template)]),
      ),
    [templates],
  );

  const handleDownloadPdf = async (item) => {
    setActionError(null);
    setDownloadingKey(String(item.exportKey ?? ""));
    try {
      await downloadChungTuPdfExport(item.exportKey);
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không tải được file PDF.");
    } finally {
      setDownloadingKey("");
    }
  };

  const handleDeletePdf = async (item) => {
    const ok = window.confirm("Xóa bản PDF này khỏi lịch sử?");
    if (!ok) return;
    setActionError(null);
    try {
      await deletePdfExport({
        exportKey: item.exportKey,
        unitId: effectiveUnitId,
        categoryKey,
      }).unwrap();
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không xóa được bản PDF.");
    }
  };

  const expandedLayout = !isLgUp;

  return (
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

      {exportsLoading ? (
        <ChungTuExportWizardCard
          title="Lịch sử PDF"
          expanded={expandedLayout}
          bodyClassName="py-6"
        >
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Đang tải lịch sử…
          </p>
        </ChungTuExportWizardCard>
      ) : pdfExports.length === 0 ? (
        <ChungTuExportWizardCard
          title="Lịch sử PDF"
          expanded={expandedLayout}
          bodyClassName="py-6"
        >
          <p className="text-center text-sm text-muted-foreground">
            Chưa có bản PDF nào cho đơn vị này.
          </p>
        </ChungTuExportWizardCard>
      ) : !isLgUp ? (
        <ChungTuExportWizardCard
          title={`Lịch sử PDF (${pdfExports.length})`}
          description="Chạm Tải PDF / Xóa trên từng bản xuất."
          expanded={expandedLayout}
          bodyClassName="divide-y divide-border/60 space-y-0 p-0"
        >
          {pdfExports.map((item) => {
            const isDownloading = downloadingKey === String(item.exportKey ?? "");
            const creatorLabel = formatCreatorLabel(item, currentUser);
            const templateLabel =
              templateLabelById.get(String(item.pdfTemplateId ?? "")) ||
              (item.pdfTemplateId != null ? `Mẫu #${item.pdfTemplateId}` : "—");
            return (
              <article key={item.exportKey} className="bg-card/30 px-3 py-3 sm:px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">{templateLabel}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{item.exportKey || "—"}</p>
                  </div>
                  <p className="text-right text-[11px] text-muted-foreground">
                    {formatExportedAt(item.createdAt)}
                  </p>
                </div>

                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
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
                </dl>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 min-w-[6rem] flex-1 gap-1.5 text-xs sm:flex-none"
                    disabled={isDownloading || deletingExport}
                    onClick={() => handleDownloadPdf(item)}
                  >
                    {isDownloading ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Download className="size-3.5" aria-hidden />
                    )}
                    Tải PDF
                  </Button>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="dangerGhost"
                      className="h-10 min-w-[5.5rem] flex-1 gap-1.5 text-xs sm:flex-none"
                      disabled={isDownloading || deletingExport}
                      onClick={() => handleDeletePdf(item)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Xóa
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </ChungTuExportWizardCard>
      ) : (
        <StickyResponsiveTable stickyLevel={2} className="border-border/80">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Thời gian</th>
                <th className="px-3 py-2 font-semibold">Kỳ</th>
                <th className="px-3 py-2 font-semibold">Mẫu</th>
                <th className="px-3 py-2 font-semibold">Người tạo</th>
                <th className="px-3 py-2 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {pdfExports.map((item) => {
                const isDownloading = downloadingKey === String(item.exportKey ?? "");
                const creatorLabel = formatCreatorLabel(item, currentUser);
                const templateLabel =
                  templateLabelById.get(String(item.pdfTemplateId ?? "")) ||
                  (item.pdfTemplateId != null ? `Mẫu #${item.pdfTemplateId}` : "—");
                return (
                  <tr key={item.exportKey} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {formatExportedAt(item.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {formatPeriodLabel(item, exportKind)}
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2 font-medium">{templateLabel}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{creatorLabel}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 gap-1 px-3 text-xs"
                          disabled={isDownloading || deletingExport}
                          onClick={() => handleDownloadPdf(item)}
                        >
                          {isDownloading ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Download className="size-3.5" aria-hidden />
                          )}
                          Tải PDF
                        </Button>
                        {canWrite ? (
                          <Button
                            type="button"
                            variant="dangerGhost"
                            className="h-8 gap-1 px-3 text-xs"
                            disabled={isDownloading || deletingExport}
                            onClick={() => handleDeletePdf(item)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            Xóa
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </StickyResponsiveTable>
      )}
    </div>
  );
}
