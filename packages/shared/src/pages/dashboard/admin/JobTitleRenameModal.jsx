import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { notifyError } from "@/services/notify";

/**
 * Modal đổi tên chức danh — cùng khung với JobTitlePermissionsModal / ConfirmProvider.
 */
export function JobTitleRenameModal({ open, jobTitle, unitLabel, onClose, onSave, saving }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && jobTitle) {
      setName(jobTitle.name ?? "");
    }
  }, [open, jobTitle?.id, jobTitle?.name]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const t = window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    });
    return () => window.cancelAnimationFrame(t);
  }, [open, jobTitle?.id]);

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

  if (!open || !jobTitle) {
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      notifyError("Nhập tên chức danh.");
      return;
    }
    if (trimmed === jobTitle.name) {
      onClose();
      return;
    }
    await onSave(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-title-rename-title"
        className={cn(
          "relative w-full max-w-md rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl",
        )}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-1 border-b border-border px-4 pb-3 pt-4 sm:px-5">
            <p
              id="job-title-rename-title"
              className="text-[10px] font-semibold uppercase tracking-wide text-primary"
            >
              Đổi tên chức danh
            </p>
            <p className="text-sm text-muted-foreground">
              Đơn vị: <span className="font-medium text-foreground">{unitLabel}</span>
            </p>
          </div>

          <div className="px-4 py-4 sm:px-5">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">Tên chức danh</span>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                placeholder="Nhập tên mới"
                autoComplete="off"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              disabled={saving}
              onClick={onClose}
            >
              Huỷ
            </Button>
            <Button type="submit" variant="primary" className="px-3 py-1.5 text-xs" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
