"use client";

import { Loader2, Pencil, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatVnd } from "@/utils/formatVnd";

function slipRefLabel(bookMmyy, slipNo) {
  const sn =
    slipNo != null && Number.isFinite(Number(slipNo))
      ? String(Number(slipNo)).padStart(4, "0")
      : "—";
  const b =
    bookMmyy != null && String(bookMmyy).trim() !== ""
      ? String(bookMmyy).trim()
      : "—";
  return `Q.${b} — Số ${sn}`;
}

/**
 * Một phiếu xuất dạng thẻ — dùng trong Lịch sử xuất kho trên màn hình hẹp.
 */
export function LttpLichSuXuatSlipCard({
  slip,
  total,
  canWrite,
  printing,
  actionsDisabled,
  onPrint,
  onEdit,
  onRecall,
}) {
  const note =
    slip.note != null && String(slip.note).trim() !== ""
      ? String(slip.note).trim()
      : null;

  return (
    <article className="rounded-xl border border-border/70 bg-card/40 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {slip.issueDate}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {slipRefLabel(slip.bookMmyy, slip.slipNo)}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
          {formatVnd(total)}
        </p>
      </div>

      <dl className="mt-2 space-y-1 text-[11px]">
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted-foreground">Đơn vị nhận</dt>
          <dd className="min-w-0 text-right font-medium text-foreground">
            {slip.recipientUnit?.name ?? "—"}
          </dd>
        </div>
        {note ? (
          <div>
            <dt className="text-muted-foreground">Chú thích</dt>
            <dd className="mt-0.5 leading-snug text-foreground">{note}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Button
          type="button"
          variant="secondary"
          className="h-9 flex-1 gap-1.5 text-xs sm:flex-none"
          disabled={printing || actionsDisabled}
          onClick={onPrint}
        >
          {printing ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Printer className="size-3.5" aria-hidden />
          )}
          In PDF
        </Button>
        {canWrite && typeof onEdit === "function" ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 flex-1 gap-1.5 text-xs sm:flex-none"
            disabled={actionsDisabled}
            onClick={onEdit}
          >
            <Pencil className="size-3.5" aria-hidden />
            Sửa
          </Button>
        ) : null}
        {canWrite ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 flex-1 gap-1.5 text-xs text-destructive hover:text-destructive sm:flex-none"
            disabled={actionsDisabled}
            onClick={onRecall}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Thu hồi
          </Button>
        ) : null}
      </div>
    </article>
  );
}
