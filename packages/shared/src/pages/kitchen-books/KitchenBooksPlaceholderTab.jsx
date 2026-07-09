"use client";

import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

/**
 * Tab sổ sách bếp ăn chưa triển khai — tách biệt luồng Chứng từ quyết toán / Nhập xuất LTTP.
 * @param {{ title: string }} props
 */
export function KitchenBooksPlaceholderTab({ title }) {
  return (
    <div className="min-w-0 px-1 py-4">
      <Card className="mx-auto max-w-md border-dashed bg-muted/20 shadow-none">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <h2 className="text-sm font-semibold text-foreground sm:text-base">{title}</h2>
          <p className="rounded-md bg-muted/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Đang phát triển
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
