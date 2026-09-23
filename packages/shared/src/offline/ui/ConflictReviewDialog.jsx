"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import {
  fetchServerEntityForItem,
  summarizeConflict,
} from "../outbox/conflictReview.js";
import { useOfflineQueue } from "../hooks/useOfflineQueue.js";
import { apiRequest } from "@/services/apiRequest";

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   items: import("../outbox/operations.js").OutboxItem[];
 *   onKeepServer: (id: string) => Promise<void>;
 *   onReapply: (id: string) => Promise<void>;
 * }} props
 */
export function ConflictReviewDialog({
  open,
  onClose,
  items,
  onKeepServer,
  onReapply,
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [serverEntity, setServerEntity] = useState(
    /** @type {Record<string, unknown>|null} */ (null),
  );
  const [busy, setBusy] = useState(false);

  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null;

  useEffect(() => {
    if (!open) {
      setDetailOpen(false);
      setServerEntity(null);
      return undefined;
    }
    setActiveId(items[0]?.id ?? null);
  }, [open, items]);

  useEffect(() => {
    if (!open || !active) {
      setServerEntity(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const entity = await fetchServerEntityForItem(active, apiRequest);
      if (!cancelled) {
        setServerEntity(entity);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, active]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const run = useCallback(
    async (fn) => {
      if (!active || busy) {
        return;
      }
      setBusy(true);
      try {
        await fn(active.id);
        onClose();
      } finally {
        setBusy(false);
      }
    },
    [active, busy, onClose],
  );

  if (!open || !active) {
    return null;
  }

  const summary = summarizeConflict(active, serverEntity);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
        aria-label="Đóng"
        disabled={busy}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-review-title"
        className={cn(
          "relative flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl",
        )}
      >
        <div className="border-b border-border p-4 sm:p-5">
          <p id="conflict-review-title" className="text-sm font-semibold text-foreground">
            Xung đột đồng bộ
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bản ghi trên server đã thay đổi khi bạn chỉnh sửa offline. Chọn cách xử lý.
          </p>
          {items.length > 1 ? (
            <ul className="mt-3 max-h-24 space-y-1 overflow-y-auto text-xs">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-md px-2 py-1 text-left",
                      item.id === active.id
                        ? "bg-violet-500/15 font-medium text-violet-950 dark:text-violet-100"
                        : "text-muted-foreground hover:bg-muted/80",
                    )}
                    onClick={() => {
                      setActiveId(item.id);
                      setDetailOpen(false);
                    }}
                  >
                    {item.operation}
                    {item.entityId ? ` · ${item.entityId}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <dl className="grid gap-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Thao tác</dt>
              <dd className="font-medium text-foreground">{summary.operation}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Phiên bản local / server</dt>
              <dd className="font-mono text-foreground">
                {String(summary.localBaseVersion)} → {String(summary.serverVersion)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Thay đổi của bạn
              </p>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[11px] text-foreground">
                {detailOpen ? summary.localPreview : summary.localPreview.split("\n").slice(0, 6).join("\n")}
              </pre>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Trên server
              </p>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[11px] text-foreground">
                {serverEntity
                  ? detailOpen
                    ? summary.serverPreview
                    : summary.serverPreview.split("\n").slice(0, 6).join("\n")
                  : "Đang tải…"}
              </pre>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4 sm:p-5">
          <Button
            type="button"
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => setDetailOpen((v) => !v)}
          >
            {detailOpen ? "Thu gọn" : "Xem chi tiết"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={onClose}
          >
            Đóng
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => run(onKeepServer)}
          >
            Giữ bản server
          </Button>
          <Button
            type="button"
            variant="primary"
            className="px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => run(onReapply)}
          >
            Áp dụng lại
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Dock + dialog when `needsReview.length > 0`. Mount under OfflineProvider. */
export function OfflineConflictDock() {
  const { needsReview, needsReviewCount, keepServer, reapply } = useOfflineQueue();
  const [open, setOpen] = useState(false);

  if (needsReviewCount === 0) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-[45] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden"
        role="status"
      >
        <button
          type="button"
          className="flex max-w-md items-center gap-2 rounded-full border border-violet-500/40 bg-violet-600 px-4 py-2 text-xs font-medium text-violet-50 shadow-lg hover:bg-violet-600/95 dark:bg-violet-700"
          onClick={() => setOpen(true)}
        >
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-violet-950/25 text-[10px] font-bold">
            {needsReviewCount}
          </span>
          Cần xem lại đồng bộ
        </button>
      </div>
      <ConflictReviewDialog
        open={open}
        onClose={() => setOpen(false)}
        items={needsReview}
        onKeepServer={keepServer}
        onReapply={reapply}
      />
    </>
  );
}
