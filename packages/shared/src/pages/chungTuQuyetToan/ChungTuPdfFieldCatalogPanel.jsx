"use client";

import { BookOpen, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { useChungTuPdfFieldCatalogQuery } from "@/features/chung-tu-quyet-toan/api/chungTuPdfApi";

export function ChungTuPdfFieldCatalogPanel() {
  const [query, setQuery] = useState("");
  const { data: fieldCatalog, isLoading: fieldCatalogLoading } =
    useChungTuPdfFieldCatalogQuery();
  const scalarFields = fieldCatalog?.scalarFields ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredFields = useMemo(() => {
    if (!normalizedQuery) {
      return scalarFields;
    }
    return scalarFields.filter((field) =>
      [field.namedRange, field.fieldKey, field.description ?? field.label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, scalarFields]);

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Tra cứu Named Range / field key</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tra cứu nhanh các Named Range scalar để gắn dữ liệu đơn khi thiết kế mẫu Excel.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo Named Range, field key hoặc mô tả"
        />
      </label>

      {fieldCatalogLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Đang tải catalog…
        </p>
      ) : (
        <StickyResponsiveTable stickyLevel={1} className="border-border/60">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-secondary/95">
              <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
                <th className="min-w-[20rem] px-3 py-2 font-medium">Tên</th>
                <th className="px-3 py-2 font-medium">Mô tả</th>
              </tr>
            </thead>
            <tbody>
              {filteredFields.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={2}>
                    Không tìm thấy field phù hợp.
                  </td>
                </tr>
              ) : (
                filteredFields.map((field) => (
                  <tr key={field.namedRange} className="border-b border-border/60 last:border-0">
                    <td className="space-y-0.5 px-3 py-2 align-top">
                      <p className="font-mono text-[11px] text-foreground">{field.namedRange}</p>
                      <p className="text-muted-foreground">{field.fieldKey}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {field.description ?? field.label ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </StickyResponsiveTable>
      )}
    </div>
  );
}
