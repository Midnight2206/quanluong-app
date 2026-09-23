"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ReconnectSyncOverlay({ error, onRetry }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 print:hidden"
      role="alertdialog"
      aria-modal="true"
      aria-busy={!error}
      aria-label="Đồng bộ dữ liệu"
    >
      <div className="mx-4 max-w-sm rounded-lg border border-border bg-card p-4 text-center shadow-lg">
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" className="mt-3" onClick={onRetry}>
              Thử lại
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm text-foreground">
              Đang đồng bộ dữ liệu từ máy chủ (bạn vừa làm việc offline)…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
