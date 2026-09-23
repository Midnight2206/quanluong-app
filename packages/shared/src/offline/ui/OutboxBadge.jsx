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
  pending: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  syncing: "bg-sky-500/15 text-sky-900 dark:text-sky-100",
  synced: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
  failed: "bg-red-500/15 text-red-900 dark:text-red-100",
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
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium leading-none",
        STATUS_CLASS[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
      title={title}
    >
      {label}
    </span>
  );
}
