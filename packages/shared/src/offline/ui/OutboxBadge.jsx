"use client";

import { cn } from "@/utils/cn";
import { OP_IMPORT_EXCEL } from "../outbox/operations.js";

/** @type {Record<string, string>} */
const STATUS_LABEL = {
  pending: "Chờ đồng bộ",
  syncing: "Đang gửi",
  synced: "Đã đồng bộ",
  failed: "Lỗi",
  needs_review: "Cần xem lại",
  conflict: "Xung đột",
};

/** @type {Record<string, string>} */
const STATUS_CLASS = {
  pending: "bg-warning/15 text-warning",
  syncing: "bg-info/15 text-info",
  synced: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  needs_review: "bg-violet-500/15 text-violet-900 dark:text-violet-100",
  conflict: "bg-orange-500/15 text-orange-900 dark:text-orange-100",
};

/**
 * @param {{ status?: string; operation?: string; className?: string; title?: string }} props
 */
export function OutboxBadge({ status = "pending", operation, className, title }) {
  let label = STATUS_LABEL[status] ?? status;
  if (
    operation === OP_IMPORT_EXCEL &&
    (status === "pending" || status === "syncing")
  ) {
    label = "đang xử lý";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-medium leading-none",
        STATUS_CLASS[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
      title={title}
    >
      {label}
    </span>
  );
}
