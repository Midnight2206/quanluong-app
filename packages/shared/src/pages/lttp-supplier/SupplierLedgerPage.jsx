"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Settings2, X } from "lucide-react";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import {
  useLttpSupplierDebtQuery,
  useLttpSupplierLedgerQuery,
  useLttpSupplierLinksQuery,
} from "@/features/lttp-supplier/api/lttpSupplierApi";
import { cn } from "@/utils/cn";
import { currentMonthYmd, monthBoundsYmd } from "@/utils/monthBoundsYmd";
import { initialSupplierId, pairLabel } from "./supplierOrderView.js";
import {
  commodityBlocks,
  commodityColumns,
  commodityColumnTotals,
  dayByCommodity,
  formatLedgerMoney,
  recipientBlocks,
} from "./supplierLedgerView.js";

const COLUMN_TINTS = [
  "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
  "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
  "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
  "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50",
  "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-50",
  "bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-50",
  "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-50",
  "bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-950 dark:text-fuchsia-50",
];

const fieldLabelClass = "text-[10px] font-medium leading-none text-muted-foreground";
const fieldControlClass =
  "h-8 w-full min-w-[7.5rem] rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary";
const chipClass = "inline-flex h-8 flex-1 items-center justify-center rounded-md px-2.5 text-xs font-medium";
/** Nền opaque (alpha 1) — không lộ nội dung cuộn phía dưới sticky. */
const stickyOpaque = "bg-background";
const stickyCellOpaque = "bg-card";
const stickyMutedOpaque = "bg-muted";

function TogglePair({ label, value, options, onChange }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn(
              chipClass,
              value === opt.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground hover:bg-background",
            )}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LedgerViewOptions({ periodMode, setPeriodMode, viewMode, setViewMode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary = `${periodMode === "month" ? "Tháng" : "Khoảng"} · ${
    viewMode === "commodity" ? "Mặt hàng" : "ĐV nhận"
  }`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Chế độ xem"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="max-w-[9rem] truncate">{summary}</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Chế độ xem sổ công nợ"
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card p-3 shadow-lg"
        >
          <div className="space-y-3">
            <TogglePair
              label="Khoảng thời gian"
              value={periodMode}
              onChange={setPeriodMode}
              options={[
                { value: "month", label: "Tháng" },
                { value: "range", label: "Khoảng" },
              ]}
            />
            <TogglePair
              label="Cách xem"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "commodity", label: "Mặt hàng" },
                { value: "recipient", label: "ĐV nhận" },
              ]}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function monthRange() {
  return monthBoundsYmd(currentMonthYmd());
}

function ledgerErrorText(error) {
  const formError = error?.data?.details?.formErrors?.[0];
  if (typeof formError === "string" && formError !== "") return formError;
  return "Không tải được sổ công nợ.";
}

function showDate(iso) {
  const [year, month, day] = String(iso).split("-");
  return `${day}/${month}/${year}`;
}

function LedgerPaymentsModal({ debt, onClose }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  const payments = debt?.payments ?? [];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-payments-title"
        className="relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="ledger-payments-title" className="text-base font-semibold text-foreground">
              Chi tiết thanh toán
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {debt?.supplierName}
              {debt?.level1UnitName ? ` · ${debt.level1UnitName}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"
            aria-label="Đóng"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted/30 px-4 py-3 text-center">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tổng nợ</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {formatLedgerMoney(debt?.totalDebtAmount ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Đã trả</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {formatLedgerMoney(debt?.totalPaidAmount ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Còn lại</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {formatLedgerMoney(debt?.remainingAmount ?? 0)}
            </p>
          </div>
        </div>

        <div data-local-scroll="true" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {payments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chưa có lần thanh toán nào.</p>
          ) : (
            <ul className="space-y-2">
              {payments.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 shadow-sm"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium tabular-nums text-foreground">{showDate(row.paymentDate)}</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatLedgerMoney(row.amount)}
                    </p>
                  </div>
                  {row.note ? <p className="mt-1 text-xs text-muted-foreground">{row.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DayDetailBody({ day, viewMode }) {
  if (viewMode === "recipient") {
    const blocks = recipientBlocks(day.lines);
    if (!blocks.length) {
      return <p className="py-8 text-center text-sm text-muted-foreground">Không có dòng trong ngày này.</p>;
    }
    return (
      <ul className="space-y-3">
        {blocks.map((block) => (
          <li
            key={block.name}
            className="rounded-xl border border-border bg-background p-3 shadow-sm"
          >
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">{block.name}</h3>
              <p className="shrink-0 tabular-nums text-sm font-semibold text-foreground">
                {formatLedgerMoney(block.amount)}
              </p>
            </div>
            <ul className="space-y-1.5 border-t border-border/70 pt-2">
              {block.items.map((item) => (
                <li key={item} className="text-[13px] leading-5 text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    );
  }

  const blocks = commodityBlocks(day.lines);
  if (!blocks.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Không có dòng trong ngày này.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {blocks.map((block) => (
        <li
          key={`${block.name}-${block.unitPrice ?? ""}`}
          className="rounded-xl border border-border bg-background p-3 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">{block.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                {block.parts.map((part) => (
                  <span
                    key={part}
                    className="inline-flex rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground"
                  >
                    {part}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground">
                Đơn giá{" "}
                <span className="tabular-nums text-foreground">
                  {block.unitPrice == null ? "—" : formatLedgerMoney(block.unitPrice)}
                </span>
              </p>
              <p className="mt-0.5 tabular-nums text-base font-semibold text-foreground">
                {formatLedgerMoney(block.amount)}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function LedgerDayModal({ days, openDate, viewMode, onViewModeChange, onClose, onSelectDate }) {
  const index = useMemo(
    () => days.findIndex((day) => day.date === openDate),
    [days, openDate],
  );
  const day = index >= 0 ? days[index] : null;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < days.length - 1;

  useEffect(() => {
    if (!day) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && hasPrev) {
        event.preventDefault();
        onSelectDate(days[index - 1].date);
      }
      if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onSelectDate(days[index + 1].date);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [day, days, hasNext, hasPrev, index, onClose, onSelectDate]);

  if (!day || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Đóng chi tiết ngày"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-day-modal-title"
        className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[85dvh] sm:rounded-2xl"
      >
        <header className="shrink-0 border-b border-border bg-card px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-background text-foreground disabled:opacity-35"
              aria-label="Ngày trước"
              disabled={!hasPrev}
              onClick={() => hasPrev && onSelectDate(days[index - 1].date)}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <h2 id="ledger-day-modal-title" className="truncate text-lg font-semibold tracking-tight text-foreground">
                {showDate(day.date)}
              </h2>
              <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                Tổng ngày{" "}
                <span className="font-semibold text-foreground">{formatLedgerMoney(day.total)}</span>
              </p>
            </div>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-background text-foreground disabled:opacity-35"
              aria-label="Ngày sau"
              disabled={!hasNext}
              onClick={() => hasNext && onSelectDate(days[index + 1].date)}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
              aria-label="Đóng"
              onClick={onClose}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div
            className="mt-3 flex gap-1 rounded-xl border border-border bg-muted/50 p-1"
            role="group"
            aria-label="Cách xem chi tiết"
          >
            {[
              { value: "commodity", label: "Mặt hàng" },
              { value: "recipient", label: "ĐV nhận" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "h-9 flex-1 rounded-lg text-sm font-medium transition-colors",
                  viewMode === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-background",
                )}
                aria-pressed={viewMode === opt.value}
                onClick={() => onViewModeChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {index + 1}/{days.length}
            <span className="mx-1.5 text-border">·</span>
            ← → để đổi ngày
          </p>
        </header>
        <div
          data-local-scroll="true"
          className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4"
        >
          <DayDetailBody day={day} viewMode={viewMode} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SupplierLedgerPage() {
  const initial = monthRange();
  const [periodMode, setPeriodMode] = useState("month");
  const [month, setMonth] = useState(initial.month ?? currentMonthYmd());
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [supplierId, setSupplierId] = useState(null);
  const [viewMode, setViewMode] = useState("commodity");
  const [openDate, setOpenDate] = useState(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const readyRef = useRef(false);

  const {
    draft,
    setDraftPayload: persistLedger,
    ready: persistReady,
  } = useDraftPersist({ draftType: "supplier-ledger", scopeId: "global" });

  const { data: linksData, isLoading: linksLoading, error: linksError } = useLttpSupplierLinksQuery();
  const links = linksData?.links ?? [];

  useLayoutEffect(() => {
    if (!persistReady || readyRef.current) return;
    readyRef.current = true;
    if (draft?.periodMode === "range" || draft?.periodMode === "month") setPeriodMode(draft.periodMode);
    if (typeof draft?.month === "string" && /^\d{4}-\d{2}$/.test(draft.month)) setMonth(draft.month);
    if (typeof draft?.from === "string") setFrom(draft.from);
    if (typeof draft?.to === "string") setTo(draft.to);
    if (draft && (draft.supplierId == null || (Number.isInteger(draft.supplierId) && draft.supplierId > 0))) {
      setSupplierId(draft.supplierId ?? null);
    }
    if (draft?.viewMode === "recipient" || draft?.viewMode === "commodity") setViewMode(draft.viewMode);
  }, [persistReady, draft]);

  useEffect(() => {
    if (periodMode !== "month") return;
    try {
      const bounds = monthBoundsYmd(month);
      setFrom(bounds.from);
      setTo(bounds.to);
    } catch {
      /* ignore bad month */
    }
  }, [periodMode, month]);

  useEffect(() => {
    const nextSupplierId = initialSupplierId(links);
    if (nextSupplierId != null) {
      setSupplierId(nextSupplierId);
      return;
    }
    if (supplierId != null && !links.some((link) => Number(link.supplierId) === Number(supplierId))) {
      setSupplierId(null);
    }
  }, [links, supplierId]);

  useEffect(() => {
    if (!readyRef.current || !persistReady) return;
    persistLedger({ periodMode, month, from, to, supplierId, viewMode });
  }, [periodMode, month, from, to, supplierId, viewMode, persistReady, persistLedger]);

  const rangeOk = from <= to;
  const { data: ledger, isLoading, isFetching, error } = useLttpSupplierLedgerQuery(
    { from, to, supplierId },
    { skip: supplierId == null || !rangeOk },
  );
  const { data: debt } = useLttpSupplierDebtQuery(supplierId, { skip: supplierId == null });

  if (linksLoading) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">Đang tải…</p>;
  }
  if (linksError) {
    return <p className="px-3 py-4 text-sm text-destructive">Không tải được danh sách nhà cung cấp.</p>;
  }
  if (links.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">Superadmin chưa gắn nhà cung cấp.</p>;
  }

  const days = ledger?.days ?? [];
  const recipientColumns = ledger?.recipientColumns ?? [];
  const byCommodityCols = commodityColumns(days);
  const columns = viewMode === "commodity" ? byCommodityCols : recipientColumns;
  const columnTotals =
    viewMode === "commodity"
      ? commodityColumnTotals(days, byCommodityCols)
      : (ledger?.columnTotals ?? {});
  const showLoader = isLoading || isFetching;

  return (
    <div className="flex w-full flex-col gap-2 px-2 pb-3 pt-1 sm:px-3">
      <div
        data-sticky-level="0"
        className={cn(
          "unified-sticky-surface -mx-2 border-b border-border px-2 py-2 sm:-mx-3 sm:px-3",
          stickyOpaque,
        )}
      >
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
          <div className="mr-1 min-w-0 shrink-0">
            <h1 className="text-sm font-semibold leading-tight text-foreground">Sổ công nợ</h1>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {ledger
                ? `Kỳ ${formatLedgerMoney(ledger.grandTotal)} · ${
                    viewMode === "commodity" ? "theo mặt hàng" : "theo ĐV nhận"
                  }`
                : "Tiền theo ngày"}
            </p>
          </div>

          {supplierId != null && debt ? (
            <button
              type="button"
              onClick={() => setPaymentsOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300/80 bg-amber-50 px-2.5 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-950"
              title="Xem chi tiết thanh toán"
            >
              <span className="font-medium text-amber-800/80 dark:text-amber-200/80">Còn nợ</span>
              <span className="tabular-nums">{formatLedgerMoney(debt.remainingAmount)}</span>
            </button>
          ) : null}

          <LedgerViewOptions
            periodMode={periodMode}
            setPeriodMode={setPeriodMode}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />

          {periodMode === "month" ? (
            <label className="grid gap-0.5" htmlFor="ledger-month">
              <span className={fieldLabelClass}>Tháng</span>
              <input
                id="ledger-month"
                type="month"
                className={fieldControlClass}
                value={month}
                onChange={(e) => setMonth(e.target.value || currentMonthYmd())}
              />
            </label>
          ) : (
            <>
              <label className="grid gap-0.5" htmlFor="ledger-from">
                <span className={fieldLabelClass}>Từ</span>
                <input
                  id="ledger-from"
                  type="date"
                  className={fieldControlClass}
                  value={from}
                  onChange={(e) => setFrom(e.target.value || initial.from)}
                />
              </label>
              <label className="grid gap-0.5" htmlFor="ledger-to">
                <span className={fieldLabelClass}>Đến</span>
                <input
                  id="ledger-to"
                  type="date"
                  className={fieldControlClass}
                  value={to}
                  onChange={(e) => setTo(e.target.value || initial.to)}
                />
              </label>
            </>
          )}

          {links.length > 1 ? (
            <label className="grid min-w-[12rem] flex-1 gap-0.5" htmlFor="ledger-link">
              <span className={fieldLabelClass}>Đơn vị · NCC</span>
              <select
                id="ledger-link"
                className={fieldControlClass}
                value={supplierId == null ? "" : String(supplierId)}
                onChange={(e) => setSupplierId(e.target.value === "" ? null : Number(e.target.value))}
                required
              >
                <option value="">Chọn…</option>
                {links.map((link) => (
                  <option key={`${link.level1UnitId}-${link.supplierId}`} value={String(link.supplierId)}>
                    {pairLabel(link)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid min-w-[10rem] gap-0.5">
              <p className={fieldLabelClass}>Đơn vị · NCC</p>
              <p className={cn(fieldControlClass, "flex items-center truncate bg-muted")}>
                {pairLabel(links[0])}
              </p>
            </div>
          )}

        </div>

        {!rangeOk ? (
          <p className="mt-1 text-[11px] text-destructive">Ngày kết thúc phải ≥ ngày bắt đầu.</p>
        ) : null}
        {error ? <p className="mt-1 text-[11px] text-destructive">{ledgerErrorText(error)}</p> : null}
        {showLoader && supplierId != null ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Đang tải…</p>
        ) : null}
      </div>

      {supplierId != null && rangeOk && !showLoader && !error && days.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Không có công nợ trong khoảng này.</p>
      ) : null}

      {days.length > 0 ? (
        <div className="overflow-visible rounded-lg border border-border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead data-sticky-level="1" className={cn("unified-sticky-surface", stickyOpaque)}>
              <tr>
                <th
                  className={cn(
                    "sticky left-0 z-[1] border-b border-r border-border px-2.5 py-1.5 text-left text-xs font-semibold",
                    stickyCellOpaque,
                  )}
                >
                  Ngày
                </th>
                {columns.map((col, index) => (
                  <th
                    key={col.id}
                    className={cn(
                      "hidden border-b border-r border-border px-2.5 py-1.5 text-center text-xs font-semibold md:table-cell",
                      COLUMN_TINTS[index % COLUMN_TINTS.length],
                    )}
                  >
                    {col.name}
                  </th>
                ))}
                <th
                  className={cn(
                    "hidden border-b border-border px-2.5 py-1.5 text-center text-xs font-semibold md:table-cell",
                    stickyMutedOpaque,
                  )}
                >
                  Tổng
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const byCol =
                  viewMode === "commodity" ? dayByCommodity(day) : (day.byRecipient ?? {});
                const active = openDate === day.date;
                return (
                  <tr
                    key={day.date}
                    className="group cursor-pointer"
                    onClick={() => setOpenDate(day.date)}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-[1] border-r border-t border-border px-2.5 py-1.5 font-medium transition-colors",
                        stickyCellOpaque,
                        active
                          ? "bg-primary/15 text-foreground"
                          : "group-hover:bg-sky-100 group-hover:text-sky-950 dark:group-hover:bg-sky-950 dark:group-hover:text-sky-50",
                      )}
                    >
                      {showDate(day.date)}
                    </td>
                    {columns.map((col, index) => (
                      <td
                        key={col.id}
                        className={cn(
                          "hidden border-r border-t border-border px-2.5 py-1.5 text-center tabular-nums transition-colors md:table-cell",
                          COLUMN_TINTS[index % COLUMN_TINTS.length],
                          active
                            ? "bg-primary/15"
                            : "group-hover:brightness-95 group-hover:saturate-150 dark:group-hover:brightness-125",
                        )}
                      >
                        {formatLedgerMoney(byCol[col.id] || 0)}
                      </td>
                    ))}
                    <td
                      className={cn(
                        "hidden border-t border-border px-2.5 py-1.5 text-center font-semibold tabular-nums transition-colors md:table-cell",
                        stickyMutedOpaque,
                        active
                          ? "bg-primary/15"
                          : "group-hover:bg-sky-100 dark:group-hover:bg-sky-950",
                      )}
                    >
                      {formatLedgerMoney(day.total)}
                    </td>
                  </tr>
                );
              })}
              <tr className="hidden md:table-row">
                <td
                  className={cn(
                    "sticky left-0 z-[1] border-r border-t border-border px-2.5 py-1.5 font-semibold",
                    stickyCellOpaque,
                  )}
                >
                  Tổng
                </td>
                {columns.map((col, index) => (
                  <td
                    key={col.id}
                    className={cn(
                      "border-r border-t border-border px-2.5 py-1.5 text-center font-semibold tabular-nums",
                      COLUMN_TINTS[index % COLUMN_TINTS.length],
                    )}
                  >
                    {formatLedgerMoney(columnTotals[col.id] || 0)}
                  </td>
                ))}
                <td
                  className={cn(
                    "border-t border-border px-2.5 py-1.5 text-center font-semibold tabular-nums",
                    stickyMutedOpaque,
                  )}
                >
                  {formatLedgerMoney(ledger.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {openDate ? (
        <LedgerDayModal
          days={days}
          openDate={openDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onClose={() => setOpenDate(null)}
          onSelectDate={setOpenDate}
        />
      ) : null}

      {paymentsOpen && debt ? (
        <LedgerPaymentsModal debt={debt} onClose={() => setPaymentsOpen(false)} />
      ) : null}
    </div>
  );
}
