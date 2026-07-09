"use client";

import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { chungTuStatusBadge, formatPeriodLabel } from "./chungTuFormat";
import { CHUNG_TU_EXPORT_KIND } from "./chungTuCategoryConfig";

function StatusBadge({ status }) {
  const badge = chungTuStatusBadge(status);
  return <span className={badge.className}>{badge.label}</span>;
}

/**
 * Một chứng từ trong lịch sử — dạng thẻ trên màn hình hẹp.
 */
export function ChungTuHistoryDocumentCard({
  doc,
  exportKind,
  canWrite,
  syncing,
  openingDoc,
  deletingDoc,
  inset = false,
  onOpen,
  onSync,
  onDelete,
}) {
  const showAggregation = exportKind === CHUNG_TU_EXPORT_KIND.MONTHLY;
  const unitLabel =
    doc.selectedUnitNames?.length > 1
      ? `${doc.unitName ?? ""} (${doc.selectedUnitNames.length} ĐV dữ liệu)`
      : doc.selectedUnitNames?.[0] ?? doc.unitName ?? "—";
  const periodLabel = formatPeriodLabel(doc, exportKind);
  const actionsBusy = syncing || openingDoc || deletingDoc;

  return (
    <article
      className={cn(
        inset
          ? "bg-card/30 px-3 py-3 sm:px-4"
          : "rounded-xl border border-border/70 bg-card/40 p-3 shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {doc.documentName || doc.templateName || "—"}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {doc.documentCode || doc.templateName || "—"}
          </p>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-muted/25 px-2.5 py-2">
          <dt className="text-[10px] uppercase text-muted-foreground">Đơn vị</dt>
          <dd className="mt-0.5 font-medium leading-snug text-foreground">{unitLabel}</dd>
        </div>
        <div className="rounded-lg bg-muted/25 px-2.5 py-2">
          <dt className="text-[10px] uppercase text-muted-foreground">
            {exportKind === CHUNG_TU_EXPORT_KIND.MONTHLY ? "Tháng/Năm" : "Ngày / Phiếu"}
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">{periodLabel}</dd>
        </div>
        {showAggregation ? (
          <div className="rounded-lg bg-muted/25 px-2.5 py-2 sm:col-span-2">
            <dt className="text-[10px] uppercase text-muted-foreground">Gộp</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {doc.aggregationModeLabel || "—"}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        {doc.outputWebViewLink ? (
          <Button
            type="button"
            variant="secondary"
            className="h-10 min-w-[5.5rem] flex-1 gap-1.5 text-xs sm:flex-none"
            disabled={actionsBusy}
            onClick={onOpen}
          >
            {openingDoc ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="size-3.5" aria-hidden />
            )}
            Mở
          </Button>
        ) : null}
        {canWrite && doc.status !== "locked" ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-10 min-w-[5.5rem] flex-1 gap-1.5 text-xs sm:flex-none"
              disabled={actionsBusy}
              onClick={onSync}
            >
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden />
              )}
              Đồng bộ
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 min-w-[5.5rem] flex-1 gap-1.5 text-xs sm:flex-none"
              disabled={actionsBusy}
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Xóa
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}
