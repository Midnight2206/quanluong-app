"use client";

import { FileQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

/**
 * Ô trống cho tab chứng từ chưa triển khai — giao diện thống nhất.
 * @param {{ label: string, subtitle: string, hint?: string }} props
 */
export function ChungTuPlaceholderWorkspace({ label, subtitle, hint }) {
  return (
    <div className="min-w-0 px-4 py-6 sm:px-6 sm:py-8">
      <Card className="mx-auto max-w-lg border-dashed bg-muted/20 shadow-none">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground sm:text-base">{label}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{subtitle}</p>
            {hint ? (
              <p className={cn("text-[11px] leading-relaxed text-muted-foreground/90 sm:text-xs")}>{hint}</p>
            ) : null}
          </div>
          <p className="rounded-md bg-muted/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Tab đặt chỗ · sắp bổ sung
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
