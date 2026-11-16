"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ClipboardCopy, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import {
  useLttpSupplierLinksQuery,
  useLttpSupplierOrdersQuery,
} from "@/features/lttp-supplier/api/lttpSupplierApi";
import {
  buildOrderingMatrix,
  buildOrderSharePlainText,
  orderSupplierFilterLabel,
} from "@/pages/lttpNhapXuat/lttpOrderingMatrix.js";
import { shiftInvoiceDateYmd } from "./supplierInvoiceView.js";
import {
  filterOrderSummaryByRecipientUnits,
  initialSupplierId,
  nextRecipientSelection,
  pairLabel,
  recipientKeys,
  toggleAllRecipientKeys,
} from "./supplierOrderView.js";
import { notifyError, notifySuccess } from "@/services/notify";
import { captureElementToPngBlob, downloadBlobAsFile } from "@/utils/captureElementToPng";
import { cn } from "@/utils/cn";

const STICKY_NAME =
  "sticky left-0 z-[2] min-w-[10rem] border-r border-border bg-card";
const STICKY_UNIT =
  "sticky left-40 z-[2] min-w-16 border-r border-border bg-secondary";
const TABLE_SCROLL =
  "min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-border [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y]";

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
const stickyOpaque = "bg-background";
const dayNavBtnClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground disabled:opacity-40";

function todayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

export function SupplierOrderPage() {
  const tableRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [orderDate, setOrderDate] = useState(() => todayIsoDate());
  const [supplierId, setSupplierId] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [showNarrowTable, setShowNarrowTable] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const orderReadyRef = useRef(false);
  const draftKeysRef = useRef(/** @type {string[] | null} */ (null));
  const selectionPrimedRef = useRef(false);

  const {
    draft: orderDraft,
    setDraftPayload: persistOrderUi,
    ready: orderPersistReady,
  } = useDraftPersist({ draftType: "supplier-order", scopeId: "global" });

  const { data: linksData, isLoading: linksLoading, error: linksError } = useLttpSupplierLinksQuery();
  const links = linksData?.links ?? [];

  useEffect(() => {
    const nextSupplierId = initialSupplierId(links);
    if (nextSupplierId != null) {
      setSupplierId(nextSupplierId);
      return;
    }
    if (supplierId != null && !links.some((link) => Number(link?.supplierId) === Number(supplierId))) {
      setSupplierId(null);
    }
  }, [links, supplierId]);

  const {
    data: summary,
    isLoading: ordersLoading,
    isFetching: ordersFetching,
    error: ordersError,
  } = useLttpSupplierOrdersQuery(
    { date: orderDate, supplierId },
    { skip: supplierId == null },
  );

  const availableRecipientKeys = useMemo(() => recipientKeys(summary), [summary]);

  useLayoutEffect(() => {
    if (!orderPersistReady || orderReadyRef.current) return;
    orderReadyRef.current = true;
    const stored = orderDraft;
    if (stored && typeof stored.orderDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(stored.orderDate)) {
      setOrderDate(stored.orderDate);
    }
    if (stored && (stored.supplierId == null || (Number.isInteger(stored.supplierId) && stored.supplierId > 0))) {
      setSupplierId(stored.supplierId ?? null);
    }
    if (stored && Array.isArray(stored.selectedKeys)) {
      draftKeysRef.current = stored.selectedKeys.map((key) => String(key));
      setSelectedKeys(draftKeysRef.current);
    }
    if (stored && typeof stored.showNarrowTable === "boolean") {
      setShowNarrowTable(stored.showNarrowTable);
    }
  }, [orderPersistReady, orderDraft]);

  useEffect(() => {
    if (!orderReadyRef.current || availableRecipientKeys.length === 0) return;
    setSelectedKeys((current) => {
      const basis = selectionPrimedRef.current ? current : draftKeysRef.current;
      return nextRecipientSelection(availableRecipientKeys, basis);
    });
    selectionPrimedRef.current = true;
  }, [availableRecipientKeys]);

  const recipientOptions = useMemo(() => {
    const labels = new Map();
    for (const col of summary?.slipColumns ?? []) {
      const key = String(col?.recipientUnitId ?? "none");
      if (!labels.has(key)) {
        labels.set(key, col?.recipientUnitName ?? "Chưa rõ đơn vị nhận");
      }
    }
    return availableRecipientKeys.map((key) => ({
      key,
      label: labels.get(key) ?? "Chưa rõ đơn vị nhận",
    }));
  }, [availableRecipientKeys, summary]);

  const filteredSummary = useMemo(
    () => filterOrderSummaryByRecipientUnits(summary, selectedKeys),
    [summary, selectedKeys],
  );
  const matrix = useMemo(
    () => (selectedKeys.length > 0 ? buildOrderingMatrix(filteredSummary) : null),
    [filteredSummary, selectedKeys],
  );
  const orderPlainText = useMemo(() => {
    if (!filteredSummary?.slipColumns?.length) return "";
    return buildOrderSharePlainText({
      orderDate,
      storageUnitName: filteredSummary.storageUnitName ?? null,
      supplierFilterLabel: orderSupplierFilterLabel(filteredSummary),
      slipColumns: filteredSummary.slipColumns,
    });
  }, [filteredSummary, orderDate]);

  useEffect(() => {
    if (!orderReadyRef.current || !orderPersistReady) return;
    persistOrderUi({ orderDate, supplierId, selectedKeys, showNarrowTable });
  }, [orderDate, supplierId, selectedKeys, showNarrowTable, orderPersistReady, persistOrderUi]);

  async function copyOrderText() {
    if (!orderPlainText) return;
    try {
      await navigator.clipboard.writeText(orderPlainText);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
      notifySuccess("Đã sao chép.");
    } catch {
      notifyError("Trình duyệt không cho phép sao chép. Hãy chọn văn bản trong ô rồi sao chép thủ công.");
    }
  }

  useEffect(() => {
    if (textOpen) return undefined;
    setCopied(false);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, [textOpen]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!textOpen) return undefined;
    const root = document.querySelector("[data-page-scroll-owner='true']");
    const prev = root instanceof HTMLElement ? root.style.overflow : "";
    if (root instanceof HTMLElement) root.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape") setTextOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      if (root instanceof HTMLElement) root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [textOpen]);

  async function downloadTableImage() {
    if (!tableRef.current || downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const blob = await captureElementToPngBlob(tableRef.current, { qualityMode: "fast" });
      downloadBlobAsFile(blob, `dat-hang-${orderDate}.png`);
    } catch {
      setDownloadError("Không tải được ảnh.");
    } finally {
      setDownloading(false);
    }
  }

  async function openTablePreview() {
    if (!tableRef.current || previewLoading) return;
    setPreviewLoading(true);
    setDownloadError("");
    try {
      const blob = await captureElementToPngBlob(tableRef.current, { qualityMode: "fast" });
      const nextUrl = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setPreviewOpen(true);
    } catch {
      setDownloadError("Không tạo được ảnh xem trước.");
      notifyError("Không tạo được ảnh xem trước.");
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!previewOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setPreviewOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  useEffect(() => {
    function onKey(event) {
      if (previewOpen || textOpen) return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || event.target.isContentEditable) {
          return;
        }
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setOrderDate((d) => shiftInvoiceDateYmd(d, -1));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setOrderDate((d) => shiftInvoiceDateYmd(d, 1));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewOpen, textOpen]);

  const allRecipientsSelected =
    recipientOptions.length > 0 && recipientOptions.every((option) => selectedKeys.includes(option.key));
  const showLoader = linksLoading || ordersLoading || ordersFetching;

  if (linksLoading) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">Đang tải…</p>;
  }

  if (linksError) {
    return <p className="px-3 py-4 text-sm text-destructive">Không tải được danh sách nhà cung cấp.</p>;
  }

  if (links.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">Superadmin chưa gắn nhà cung cấp.</p>;
  }

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
            <h1 className="text-sm font-semibold leading-tight text-foreground">Đặt hàng trong ngày</h1>
            <p className="text-[11px] text-muted-foreground">← → đổi ngày</p>
          </div>

          <div className="grid gap-0.5">
            <span className={fieldLabelClass}>Ngày</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={dayNavBtnClass}
                aria-label="Ngày trước"
                onClick={() => setOrderDate((d) => shiftInvoiceDateYmd(d, -1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <input
                id="supplier-order-date"
                type="date"
                className={cn(fieldControlClass, "min-w-[9.5rem]")}
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value || todayIsoDate())}
              />
              <button
                type="button"
                className={dayNavBtnClass}
                aria-label="Ngày sau"
                onClick={() => setOrderDate((d) => shiftInvoiceDateYmd(d, 1))}
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {links.length > 1 ? (
            <label className="grid min-w-[12rem] flex-1 gap-0.5" htmlFor="supplier-order-link">
              <span className={fieldLabelClass}>Đơn vị · NCC</span>
              <select
                id="supplier-order-link"
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

        {supplierId == null ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Chọn đơn vị và nhà cung cấp.</p>
        ) : null}
        {ordersError ? <p className="mt-1 text-[11px] text-destructive">Không tải được đặt hàng.</p> : null}
        {showLoader && supplierId != null ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Đang tải…</p>
        ) : null}

        {recipientOptions.length > 0 ? (
          <fieldset className="mt-2 space-y-1.5 border-t border-border/70 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-[11px] font-medium text-foreground">Đơn vị nhận</legend>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-foreground"
                onClick={() =>
                  setSelectedKeys((prev) => toggleAllRecipientKeys(availableRecipientKeys, prev))
                }
              >
                {allRecipientsSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recipientOptions.map((option) => {
                const checked = selectedKeys.includes(option.key);
                return (
                  <label
                    key={option.key}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-foreground"
                  >
                    <input
                      type="checkbox"
                      id={`supplier-recipient-${option.key}`}
                      className="size-3.5"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedKeys((prev) =>
                          e.target.checked ? [...prev, option.key] : prev.filter((key) => key !== option.key),
                        );
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {supplierId != null && recipientOptions.length > 0 && selectedKeys.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Chọn ít nhất một đơn vị nhận.</p>
        ) : null}
      </div>

      {supplierId != null && selectedKeys.length > 0 && matrix?.rows?.length ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {orderPlainText ? (
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground"
                onClick={() => setTextOpen(true)}
              >
                Xem bằng chữ
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground disabled:opacity-60"
              onClick={() => void openTablePreview()}
              disabled={previewLoading}
            >
              {previewLoading ? "Đang tạo ảnh…" : "Xem ảnh"}
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
              onClick={() => void downloadTableImage()}
              disabled={downloading}
            >
              {downloading ? "Đang tạo ảnh…" : "Tải ảnh"}
            </button>
            {downloadError ? <p className="w-full text-[11px] text-destructive">{downloadError}</p> : null}
          </div>

          <Card className="overflow-visible" data-lttp-ordering-card>
            <CardContent className="space-y-3 !p-2 sm:!p-3">
              <div ref={tableRef} className="space-y-3 bg-background">
                <div className="space-y-1 px-1">
                  <h2 className="text-sm font-semibold text-foreground">Bảng đặt hàng</h2>
                  <p className="text-sm text-muted-foreground">{orderDate}</p>
                </div>

                <div
                  className={TABLE_SCROLL}
                  data-lttp-ordering-table-scroll
                  role="region"
                  aria-label="Bảng đặt hàng — cuộn ngang"
                  tabIndex={0}
                >
                  <table className="w-max min-w-[48rem] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th
                          className={cn(
                            STICKY_NAME,
                            "border-b px-3 py-2 text-left font-semibold text-foreground",
                          )}
                        >
                          Mặt hàng
                        </th>
                        <th
                          className={cn(
                            STICKY_UNIT,
                            "border-b px-3 py-2 text-center font-semibold text-secondary-foreground",
                          )}
                        >
                          ĐVT
                        </th>
                        {matrix.columns.map((col) => {
                          const tint = COLUMN_TINTS[col.styleIdx % COLUMN_TINTS.length];
                          return (
                            <th
                              key={col.key}
                              className={cn(
                                "min-w-36 border-b border-r border-border px-3 py-2 text-center font-semibold last:border-r-0",
                                tint,
                              )}
                            >
                              <div className="text-xs font-medium opacity-80">{col.refLabel}</div>
                              <div>{col.recipientUnitName}</div>
                            </th>
                          );
                        })}
                        <th className="min-w-24 border-b border-border bg-muted px-3 py-2 text-center font-semibold text-foreground">
                          Tổng
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.rows.map((row) => (
                        <tr key={row.commodityId}>
                          <td className={cn(STICKY_NAME, "border-t px-3 py-2 text-foreground")}>{row.name}</td>
                          <td
                            className={cn(
                              STICKY_UNIT,
                              "border-t bg-secondary/70 px-3 py-2 text-center text-secondary-foreground",
                            )}
                          >
                            {row.measureUnit || "—"}
                          </td>
                          {matrix.columns.map((col) => {
                            const cell = matrix.qtyBySlip.get(col.key)?.get(row.commodityId);
                            const tint = COLUMN_TINTS[col.styleIdx % COLUMN_TINTS.length];
                            return (
                              <td
                                key={`${row.commodityId}-${col.key}`}
                                className={cn(
                                  "border-r border-t border-border px-3 py-2 text-center last:border-r-0",
                                  tint,
                                )}
                              >
                                <div className="font-medium">{cell?.quantityFormatted ?? "—"}</div>
                                {cell?.lineNote ? (
                                  <div className="text-xs opacity-80">({cell.lineNote})</div>
                                ) : null}
                              </td>
                            );
                          })}
                          <td className="border-t border-border bg-muted px-3 py-2 text-center font-semibold text-foreground">
                            {row.quantityFormatted}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {supplierId != null && selectedKeys.length > 0 && !showLoader && !ordersError && !matrix?.rows?.length ? (
        <p className="text-sm text-muted-foreground">Không có đặt hàng trong ngày này.</p>
      ) : null}

      {textOpen && orderPlainText
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex sm:items-center sm:justify-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0 hidden bg-black/60 sm:block"
                aria-label="Đóng"
                onClick={() => setTextOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="supplier-order-text-title"
                className="relative flex h-dvh w-full flex-col overflow-hidden bg-card sm:h-[min(90dvh,40rem)] sm:max-w-3xl sm:rounded-xl sm:border sm:border-border sm:shadow-lg"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <h2 id="supplier-order-text-title" className="min-w-0 text-lg font-semibold text-foreground">
                    Đặt hàng
                  </h2>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex size-14 items-center justify-center rounded-xl border",
                        copied
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-border bg-background text-foreground",
                      )}
                      aria-label={copied ? "Đã sao chép" : "Sao chép"}
                      onClick={() => void copyOrderText()}
                    >
                      <ClipboardCopy className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                      aria-label="Đóng"
                      onClick={() => setTextOpen(false)}
                    >
                      <X className="size-5" aria-hidden />
                    </button>
                  </div>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm leading-6 text-foreground">
                  {orderPlainText}
                </pre>
              </div>
            </div>,
            document.body,
          )
        : null}

      {previewOpen
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex flex-col bg-black/85 p-3 sm:p-6">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white">Ảnh bảng đặt hàng</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center rounded-lg border border-white/30 bg-white/10 px-3 text-sm font-medium text-white"
                    onClick={() => void downloadTableImage()}
                    disabled={downloading}
                  >
                    {downloading ? "Đang tải…" : "Tải ảnh"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-lg bg-white text-foreground"
                    aria-label="Đóng"
                    onClick={() => setPreviewOpen(false)}
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
              </div>
              <div
                className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
                data-local-scroll="true"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Ảnh bảng đặt hàng"
                    className="max-h-full max-w-full rounded-lg bg-white object-contain"
                  />
                ) : (
                  <p className="py-10 text-center text-sm text-white/80">Không có ảnh xem trước.</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
