"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import {
  useLttpSupplierDailyInvoiceQuery,
  useLttpSupplierLinksQuery,
} from "@/features/lttp-supplier/api/lttpSupplierApi";
import { QUANLUONG_BRAND_LOGO_MARK_SRC } from "@/lib/quanLuongPageMeta";
import { cn } from "@/utils/cn";
import { vndToVietnameseDocumentLine } from "@/utils/vndVietnameseText";
import { formatLedgerMoney } from "./supplierLedgerView.js";
import { formatInvoiceLongDate, shiftInvoiceDateYmd } from "./supplierInvoiceView.js";
import { initialSupplierId, pairLabel } from "./supplierOrderView.js";
import { openSupplierDailyInvoicePdfInTab } from "./supplierDailyInvoicePdfOpen.js";

const fieldLabelClass = "text-[10px] font-medium leading-none text-muted-foreground";
const fieldControlClass =
  "h-8 w-full min-w-[7.5rem] rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary";
const stickyOpaque = "bg-background";

function todayYmd() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function DayNavButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full border border-sky-300/80 bg-white/95 text-sky-900 shadow-md backdrop-blur-sm transition hover:bg-sky-50 sm:size-12"
    >
      {children}
    </button>
  );
}

export function SupplierInvoicePage() {
  const [date, setDate] = useState(todayYmd);
  const [supplierId, setSupplierId] = useState(null);
  const readyRef = useRef(false);
  const { draft, setDraftPayload: persist, ready: persistReady } = useDraftPersist({
    draftType: "supplier-daily-invoice",
    scopeId: "global",
  });

  const { data: linksData, isLoading: linksLoading, error: linksError } = useLttpSupplierLinksQuery();
  const links = linksData?.links ?? [];

  useLayoutEffect(() => {
    if (!persistReady || readyRef.current) return;
    readyRef.current = true;
    if (typeof draft?.date === "string") setDate(draft.date);
    if (draft && (draft.supplierId == null || (Number.isInteger(draft.supplierId) && draft.supplierId > 0))) {
      setSupplierId(draft.supplierId ?? null);
    }
  }, [persistReady, draft]);

  useEffect(() => {
    const next = initialSupplierId(links);
    if (next != null) {
      setSupplierId(next);
      return;
    }
    if (supplierId != null && !links.some((link) => Number(link.supplierId) === Number(supplierId))) {
      setSupplierId(null);
    }
  }, [links, supplierId]);

  useEffect(() => {
    if (!readyRef.current || !persistReady) return;
    persist({ date, supplierId });
  }, [date, supplierId, persistReady, persist]);

  useEffect(() => {
    function onKey(event) {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || event.target.isContentEditable) {
          return;
        }
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setDate((d) => shiftInvoiceDateYmd(d, -1));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setDate((d) => shiftInvoiceDateYmd(d, 1));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: invoice, isLoading, isFetching, error } = useLttpSupplierDailyInvoiceQuery(
    { date, supplierId },
    { skip: supplierId == null || !date },
  );

  if (linksLoading) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">Đang tải…</p>;
  }
  if (linksError) {
    return <p className="px-3 py-4 text-sm text-destructive">Không tải được danh sách nhà cung cấp.</p>;
  }
  if (links.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">Superadmin chưa gắn nhà cung cấp.</p>;
  }

  const lines = invoice?.lines ?? [];
  const seller = invoice?.seller;
  const buyer = invoice?.buyer;
  const showLoader = isLoading || isFetching;
  const words = invoice ? vndToVietnameseDocumentLine(invoice.grandTotal) || "—" : "—";

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
            <h1 className="text-sm font-semibold leading-tight text-foreground">Hoá đơn hằng ngày</h1>
            <p className="text-[11px] text-muted-foreground">
              {invoice && !showLoader
                ? formatInvoiceLongDate(invoice.date)
                : "A4 · ← → đổi ngày"}
            </p>
          </div>

          <label className="grid gap-0.5" htmlFor="invoice-date">
            <span className={fieldLabelClass}>Ngày</span>
            <input
              id="invoice-date"
              type="date"
              className={fieldControlClass}
              value={date}
              onChange={(e) => setDate(e.target.value || todayYmd())}
            />
          </label>

          {links.length > 1 ? (
            <label className="grid min-w-[12rem] flex-1 gap-0.5" htmlFor="invoice-link">
              <span className={fieldLabelClass}>Đơn vị · NCC</span>
              <select
                id="invoice-link"
                className={fieldControlClass}
                value={supplierId == null ? "" : String(supplierId)}
                onChange={(e) => setSupplierId(e.target.value === "" ? null : Number(e.target.value))}
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

          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            disabled={supplierId == null || !date || showLoader}
            onClick={() => {
              const tab = window.open("about:blank", "_blank");
              void openSupplierDailyInvoicePdfInTab({ date, supplierId }, { targetWindow: tab });
            }}
          >
            <Printer className="size-3.5" aria-hidden />
            In PDF
          </button>
        </div>
        {error ? <p className="mt-1 text-[11px] text-destructive">Không tải được hoá đơn.</p> : null}
        {showLoader && supplierId != null ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Đang tải…</p>
        ) : null}
      </div>

      {invoice && !showLoader ? (
        <div className="mx-auto flex max-w-full items-start justify-center gap-1.5 pb-6 sm:gap-2">
          <div className="sticky top-1/2 z-10 -mt-5 shrink-0 self-start print:hidden sm:-mt-6">
            <DayNavButton label="Ngày trước" onClick={() => setDate((d) => shiftInvoiceDateYmd(d, -1))}>
              <ChevronLeft className="size-5 sm:size-6" aria-hidden />
            </DayNavButton>
          </div>

          <div className="min-w-0 max-w-full flex-1 overflow-x-auto sm:flex-none">
            <article
              className="relative mx-auto min-h-[297mm] w-[210mm] max-w-full overflow-hidden rounded-xl border-2 border-sky-500/70 bg-[#fbfcff] p-5 text-[#0f2744] shadow-soft sm:p-7 print:border print:shadow-none"
              aria-label="Xem trước hoá đơn"
            >
              <img
                src={QUANLUONG_BRAND_LOGO_MARK_SRC}
                alt=""
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[46%] w-[58%] max-w-[22rem] -translate-x-1/2 -translate-y-1/2 opacity-[0.08] select-none"
              />

              <header className="relative mb-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                <div className="flex gap-2.5">
                  <img
                    src={QUANLUONG_BRAND_LOGO_MARK_SRC}
                    alt="Midnight"
                    className="size-11 shrink-0 rounded-full object-contain"
                  />
                  <div className="min-w-0 space-y-0.5 text-[11px] leading-4 sm:text-xs">
                    <p className="truncate text-sm font-bold uppercase tracking-wide">{seller?.name || "—"}</p>
                    {seller?.taxCode ? <p>MST: {seller.taxCode}</p> : null}
                    {seller?.address ? <p className="line-clamp-2">Địa chỉ: {seller.address}</p> : null}
                    {seller?.phone ? <p>Điện thoại: {seller.phone}</p> : null}
                    {seller?.email ? <p>Email: {seller.email}</p> : null}
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-base font-bold tracking-wide sm:text-lg">HOÁ ĐƠN ĐIỆN TỬ</h2>
                  <p className="mt-1 text-sm italic text-sky-900/80">{formatInvoiceLongDate(invoice.date)}</p>
                </div>
                <div className="space-y-1 text-right text-xs sm:pt-1">
                  <p>Ký hiệu: …</p>
                  <p>Số: …</p>
                </div>
              </header>

              <div className="relative mb-3 border-t border-sky-400/60 pt-3 text-[12px] leading-5 sm:text-[13px]">
                <p>
                  <span className="text-sky-900/70">Họ tên người mua hàng:</span> ……………………
                </p>
                <p>
                  <span className="text-sky-900/70">Tên đơn vị:</span> {buyer?.name || "—"}
                </p>
                <p>
                  <span className="text-sky-900/70">Địa chỉ:</span> ……………………
                </p>
                <p className="flex flex-wrap gap-x-6">
                  <span>
                    <span className="text-sky-900/70">Hình thức thanh toán:</span> …
                  </span>
                  <span>
                    <span className="text-sky-900/70">Đồng tiền:</span> VND
                  </span>
                </p>
              </div>

              <table className="relative w-full border-collapse text-left text-[11px] sm:text-xs">
                <thead>
                  <tr className="bg-sky-100/80 text-[#0f2744]">
                    <th className="border border-sky-300/70 px-1.5 py-1.5 font-semibold">STT</th>
                    <th className="border border-sky-300/70 px-1.5 py-1.5 font-semibold">Tên hàng hoá, dịch vụ</th>
                    <th className="border border-sky-300/70 px-1.5 py-1.5 font-semibold">ĐVT</th>
                    <th className="border border-sky-300/70 px-1.5 py-1.5 text-right font-semibold">Số lượng</th>
                    <th className="border border-sky-300/70 px-1.5 py-1.5 text-right font-semibold">Đơn giá</th>
                    <th className="border border-sky-300/70 px-1.5 py-1.5 text-right font-semibold">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border border-sky-200 px-2 py-8 text-center text-muted-foreground">
                        Không có dòng trong ngày này.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line, index) => (
                      <tr key={`${line.commodityId}-${line.unitPrice}-${index}`}>
                        <td className="border border-sky-200 px-1.5 py-1 tabular-nums">{index + 1}</td>
                        <td className="border border-sky-200 px-1.5 py-1">{line.name}</td>
                        <td className="border border-sky-200 px-1.5 py-1">{line.measureUnit || "—"}</td>
                        <td className="border border-sky-200 px-1.5 py-1 text-right tabular-nums">
                          {line.quantityFormatted}
                        </td>
                        <td className="border border-sky-200 px-1.5 py-1 text-right tabular-nums">
                          {line.unitPrice == null ? "—" : formatLedgerMoney(line.unitPrice)}
                        </td>
                        <td className="border border-sky-200 px-1.5 py-1 text-right tabular-nums font-medium">
                          {formatLedgerMoney(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="relative mt-3 space-y-1.5 text-[12px] sm:text-[13px]">
                <div className="flex justify-between gap-4 border-b border-sky-200 pb-1">
                  <span>Cộng tiền hàng</span>
                  <span className="tabular-nums font-semibold">{formatLedgerMoney(invoice.grandTotal)}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-sky-200 pb-1">
                  <span>Thuế suất GTGT: đã bao gồm</span>
                  <span className="tabular-nums">—</span>
                </div>
                <div className="flex justify-between gap-4 pt-0.5 text-sm font-bold">
                  <span>Tổng cộng tiền thanh toán</span>
                  <span className="tabular-nums">{formatLedgerMoney(invoice.grandTotal)}</span>
                </div>
                <p className="pt-1 italic text-sky-950/80">Số tiền viết bằng chữ: {words}</p>
                <p className="text-[11px] text-sky-900/70">{invoice.note}</p>
              </div>

              <footer className="relative mt-10 grid grid-cols-2 gap-4 text-center text-[12px] sm:mt-14 sm:text-[13px]">
                <div>
                  <p className="font-semibold">Người mua hàng</p>
                  <p className="mt-1 text-[11px] italic text-sky-900/70">(Ký, ghi rõ họ tên)</p>
                </div>
                <div>
                  <p className="font-semibold">Người bán hàng</p>
                  <p className="mt-1 text-[11px] italic text-sky-900/70">(Ký, ghi rõ họ tên)</p>
                  <p className="mt-10 font-semibold">{seller?.name || ""}</p>
                  {seller?.representativeName ? (
                    <p className="text-[11px] text-sky-900/70">{seller.representativeName}</p>
                  ) : null}
                </div>
              </footer>
            </article>
          </div>

          <div className="sticky top-1/2 z-10 -mt-5 shrink-0 self-start print:hidden sm:-mt-6">
            <DayNavButton label="Ngày sau" onClick={() => setDate((d) => shiftInvoiceDateYmd(d, 1))}>
              <ChevronRight className="size-5 sm:size-6" aria-hidden />
            </DayNavButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
