"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/utils/cn";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function getTemplateLabel(template) {
  if (!template) return "";
  const base = template.displayName || template.name || `Mẫu #${template.id}`;
  return template.version ? `${base} (v${template.version})` : base;
}

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   templates?: Array<{ id: number|string, displayName?: string, name?: string, version?: string|number }>,
 *   defaultTemplateId?: number|string|null,
 *   title?: string,
 *   submitting?: boolean,
 *   onSubmit: (payload: { pdfTemplateId: number, refreshData: boolean }) => void | Promise<void>,
 * }} props
 */
export function ChungTuReExportDialog({
  open,
  onOpenChange,
  templates = [],
  defaultTemplateId = null,
  title = "Xuất lại chứng từ",
  submitting = false,
  onSubmit,
}) {
  const [pdfTemplateId, setPdfTemplateId] = useState("");
  const [refreshData, setRefreshData] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (!open) return;
    const fallback = templates[0]?.id;
    const initial =
      defaultTemplateId != null &&
      templates.some((t) => String(t.id) === String(defaultTemplateId))
        ? defaultTemplateId
        : fallback;
    setPdfTemplateId(initial != null ? String(initial) : "");
    setRefreshData(false);
    setLocalError(null);
  }, [open, defaultTemplateId, templates]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);
    const id = Number(pdfTemplateId);
    if (!Number.isFinite(id) || id <= 0) {
      setLocalError("Chọn mẫu PDF đã publish.");
      return;
    }
    try {
      await onSubmit({ pdfTemplateId: id, refreshData: refreshData === true });
    } catch (e) {
      setLocalError(e?.data?.message || e?.message || "Xuất lại thất bại.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[230] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chung-tu-reexport-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Đóng"
        disabled={submitting}
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-background shadow-lg sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 space-y-1">
            <h2 id="chung-tu-reexport-title" className="text-sm font-semibold text-foreground">
              {title}
            </h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Giữ số chứng từ và quyển số; ghi đè PDF trong folder cũ. Chữ ký lấy lại từ cài đặt hiện tại.
            </p>
          </div>
          <IconButton
            label="Đóng"
            variant="ghost"
            className="shrink-0"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </header>

        <form className="space-y-4 px-4 py-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Mẫu PDF</span>
            <select
              className={cn(fieldClass)}
              value={pdfTemplateId}
              disabled={submitting || templates.length === 0}
              onChange={(e) => setPdfTemplateId(e.target.value)}
              required
            >
              {templates.length === 0 ? (
                <option value="">Chưa có mẫu publish</option>
              ) : (
                templates.map((template) => (
                  <option key={template.id} value={String(template.id)}>
                    {getTemplateLabel(template)}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-border"
              checked={refreshData}
              disabled={submitting}
              onChange={(e) => setRefreshData(e.target.checked)}
            />
            <span>
              <span className="font-medium">Đọc lại dữ liệu nguồn</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Tắt (mặc định): dùng snapshot đã lưu. Bật: resolve lại LTTP/BKMH; sheet mới nhận số tiếp theo.
              </span>
            </span>
          </label>

          {localError ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {localError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" className="h-10 gap-1.5" disabled={submitting || !pdfTemplateId}>
              {submitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Xuất lại
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
