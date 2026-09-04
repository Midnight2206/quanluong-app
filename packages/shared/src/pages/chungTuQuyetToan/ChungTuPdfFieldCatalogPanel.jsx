"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { useChungTuPdfFieldCatalogQuery } from "@/features/chung-tu-quyet-toan/api/chungTuPdfApi";

export function ChungTuPdfFieldCatalogPanel() {
  const { data: fieldCatalog, isLoading: fieldCatalogLoading } =
    useChungTuPdfFieldCatalogQuery();

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Tra cứu Named Range / field key</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dùng Named Range `FIELD_*` cho dữ liệu đơn và `TABLE_HEADER`/`TABLE_DATA_ROW` cho phần
            bảng dòng hàng khi thiết kế mẫu Excel.
          </p>
        </div>
      </div>

      {fieldCatalogLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Đang tải catalog…
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
              Scalar fields
            </p>
            <div className="space-y-2 text-xs">
              {(fieldCatalog?.scalarFields ?? []).map((field) => (
                <div key={field.namedRange} className="rounded-md bg-muted/25 px-2.5 py-2">
                  <p className="font-mono text-[11px] text-foreground">{field.namedRange}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {field.fieldKey} · {field.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
              Gợi ý tiêu đề cột bảng
            </p>
            <div className="space-y-2 text-xs">
              {(fieldCatalog?.tableColumns ?? []).map((column, index) => (
                <div
                  key={`${column.label}-${column.fieldKey}-${index}`}
                  className="rounded-md bg-muted/25 px-2.5 py-2"
                >
                  <p className="font-medium text-foreground">{column.label}</p>
                  <p className="mt-0.5 text-muted-foreground">fieldKey: {column.fieldKey}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
