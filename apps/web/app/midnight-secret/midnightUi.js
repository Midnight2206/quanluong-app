/** Shared tiny helpers for báo cáo nội bộ UI. */

export function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function firstDayOfMonthYmd() {
  const d = new Date();
  d.setDate(1);
  return localYmd(d);
}

export function formatVnd(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n));
}

export function formatVndBlankZero(n) {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) === 0) return "—";
  return formatVnd(n);
}

export const fieldClass =
  "mt-0.5 block h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const labelClass = "text-[11px] font-medium text-muted-foreground";

export const btnSecondary =
  "inline-flex h-9 items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50";

export const btnPrimary =
  "inline-flex h-9 items-center justify-center rounded-md border border-primary bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50";

export const toolbarClass =
  "flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-2 sm:gap-3";

export const tableWrapClass =
  "overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-card";

export const thClass =
  "px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export const tdClass = "px-2.5 py-1 text-sm text-foreground";
