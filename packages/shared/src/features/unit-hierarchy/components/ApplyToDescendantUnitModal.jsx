import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/utils/cn";
import { ArrowDownToLine, X } from "lucide-react";

const selectClass =
  "w-full rounded-lg border border-border bg-background px-2 py-2 text-xs outline-none focus:border-primary sm:text-sm";

/**
 * Modal tái sử dụng: chọn **một** đơn vị cấp dưới để áp dữ liệu từ cấp trên.
 */
export function ApplyToDescendantUnitModal({
  open,
  onClose,
  title,
  hint,
  options,
  formatOptionLabel,
  onConfirm,
  loading,
  confirmLabel = "Áp xuống đơn vị đã chọn",
}) {
  const [pick, setPick] = useState("");

  useEffect(() => {
    if (open) {
      setPick("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const disabled = loading || !pick;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-lg sm:rounded-2xl",
        )}
      >
        <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-semibold">{title}</h2>
            {hint ? <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">{hint}</p> : null}
          </div>
          <IconButton label="Đóng" variant="ghost" className="shrink-0" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
          <label className="block space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground">Đơn vị cấp dưới</span>
            <select className={selectClass} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">— Chọn đơn vị —</option>
              {(options || []).map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {formatOptionLabel ? formatOptionLabel(u) : `${u.name ?? u.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-2 sm:px-4">
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/80"
            onClick={onClose}
          >
            Hủy
          </button>
          <IconButton
            label={confirmLabel}
            variant="primary"
            loading={loading}
            disabled={disabled}
            onClick={() => {
              if (!pick) {
                return;
              }
              onConfirm(Number(pick));
            }}
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden />
          </IconButton>
        </footer>
      </div>
    </div>
  );
}
