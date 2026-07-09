"use client";

import { detailFieldLabel } from "./chungTuDetailFieldCatalog";
import { excelColumnLetter } from "./chungTuFormat";

/**
 * Một dòng map cột — dạng thẻ trên màn hình hẹp.
 */
export function ChungTuColumnMappingCard({
  mapping,
  index,
  detailFieldOptions,
  canWrite,
  onFieldKeyChange,
}) {
  const title =
    (mapping.fieldKey ? detailFieldLabel(mapping.fieldKey) : null) ||
    mapping.label ||
    "—";

  return (
    <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 text-xs">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="min-w-0 font-medium leading-snug text-foreground">{title}</p>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {excelColumnLetter(mapping.col)} ({mapping.col})
        </span>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">Logic fill dữ liệu</span>
        <select
          className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs outline-none focus:border-primary"
          value={mapping.fieldKey ?? ""}
          disabled={!canWrite}
          onChange={(e) => onFieldKeyChange(index, e.target.value)}
        >
          <option value="">— Không fill —</option>
          {detailFieldOptions.map((opt) => (
            <option key={opt.fieldKey} value={opt.fieldKey}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
