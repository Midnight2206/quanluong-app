"use client";

import { Pencil, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { formatVnd } from "@/utils/formatVnd";

/**
 * Thẻ mức tiền ăn — danh mục mức ăn trên màn hình hẹp.
 */
export function DashboardMealRateCard({
  row,
  typeLabel,
  isSuperadmin,
  deleting,
  onEdit,
  onDelete,
}) {
  return (
    <article className="-mx-3 rounded-none border-x-0 border-y border-border/70 bg-card/40 p-3 shadow-sm first:border-t sm:mx-0 sm:rounded-xl sm:border sm:border-border/70">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {typeLabel(row.type)}
        </p>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {formatVnd(row.mucTienAn)}
        </p>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-xs leading-snug text-foreground">
        {row.doiTuong}
      </p>
      {isSuperadmin ? (
        <div className="mt-3 flex justify-end gap-1 border-t border-border/60 pt-3">
          <IconButton label="Sửa" variant="surface" onClick={() => onEdit(row)}>
            <Pencil aria-hidden />
          </IconButton>
          <IconButton
            label="Xóa"
            variant="danger"
            disabled={deleting}
            onClick={() => onDelete(row.id)}
          >
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      ) : null}
    </article>
  );
}
