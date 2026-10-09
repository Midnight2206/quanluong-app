"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardCopy, X } from "lucide-react";
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
import {
  filterOrderSummaryByRecipientUnits,
  initialSupplierId,
  nextRecipientSelection,
  pairLabel,
  recipientKeys,
} from "./supplierOrderView.js";
import { notifyError, notifySuccess } from "@/services/notify";
import { captureElementToPngBlob, downloadBlobAsFile } from "@/utils/captureElementToPng";
import { cn } from "@/utils/cn";

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

const fieldLabelClass = "text-xs font-medium leading-4 text-foreground";
const fieldControlClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary";

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
    <div className="flex w-full flex-col gap-3 px-2 py-3 sm:px-3">
      <div className="space-y-1 px-1">
        <h1 className="text-xl font-semibold text-foreground">Đặt hàng trong ngày</h1>
        <p className="text-sm text-muted-foreground">Chọn ngày và đơn vị nhận để xem bảng.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 !p-3 sm:!p-4">
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5" htmlFor="supplier-order-date">
              <span className={fieldLabelClass}>Ngày</span>
              <input
                id="supplier-order-date"
                type="date"
                className={fieldControlClass}
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value || todayIsoDate())}
              />
            </label>

            {links.length > 1 ? (
              <label className="grid gap-1.5" htmlFor="supplier-order-link">
                <span className={fieldLabelClass}>Đơn vị và nhà cung cấp</span>
                <select
                  id="supplier-order-link"
                  className={fieldControlClass}
                  value={supplierId == null ? "" : String(supplierId)}
                  onChange={(e) => setSupplierId(e.target.value === "" ? null : Number(e.target.value))}
                  required
                >
                  <option value="">Chọn đơn vị và nhà cung cấp</option>
                  {links.map((link) => (
                    <option key={`${link.level1UnitId}-${link.supplierId}`} value={String(link.supplierId)}>
                      {pairLabel(link)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grid gap-1.5">
                <p className={fieldLabelClass}>Đơn vị và nhà cung cấp</p>
                <p className={cn(fieldControlClass, "flex items-center bg-muted/40")}>
                  {pairLabel(links[0])}
                </p>
              </div>
            )}
          </div>

          {supplierId == null ? (
            <p className="text-sm text-muted-foreground">Chọn đơn vị và nhà cung cấp.</p>
          ) : null}

          {ordersError ? <p className="text-sm text-destructive">Không tải được đặt hàng.</p> : null}

          {showLoader && supplierId != null ? <p className="text-sm text-muted-foreground">Đang tải…</p> : null}

          {recipientOptions.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Đơn vị nhận</legend>
              <div className="flex flex-wrap gap-2">
                {recipientOptions.map((option) => {
                  const checked = selectedKeys.includes(option.key);
                  return (
                    <label
                      key={option.key}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        id={`supplier-recipient-${option.key}`}
                        className="size-4"
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
            <p className="text-sm text-muted-foreground">Chọn ít nhất một đơn vị nhận.</p>
          ) : null}
        </CardContent>
      </Card>

      {supplierId != null && selectedKeys.length > 0 && matrix?.rows?.length ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-3 md:hidden">
            <p className="text-sm text-foreground">Màn hình nhỏ không phù hợp để hiển thị bảng.</p>
            <div className="flex flex-wrap gap-2">
              {orderPlainText ? (
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
                  onClick={() => setTextOpen(true)}
                >
                  Xem bằng chữ
                </button>
              ) : null}
              {showNarrowTable ? null : (
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                  onClick={() => setShowNarrowTable(true)}
                >
                  Xem bảng
                </button>
              )}
            </div>
          </div>

          <Card className={cn("overflow-visible", showNarrowTable ? "block" : "hidden md:block")}>
            <CardContent className="space-y-3 !p-2 sm:!p-3">
              <div className="relative">
                <div className="absolute right-1 top-0 z-10 hidden items-start gap-2 md:flex">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
                    onClick={() => setTextOpen(true)}
                  >
                    Xem bằng chữ
                  </button>
                  <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    onClick={downloadTableImage}
                    disabled={downloading}
                  >
                    {downloading ? "Đang tạo ảnh…" : "Tải ảnh"}
                  </button>
                  {downloadError ? <p className="text-xs text-destructive">{downloadError}</p> : null}
                  </div>
                </div>
              <div ref={tableRef} className="space-y-3 bg-background">
                <div className="space-y-1 px-1 md:pr-56">
                  <h2 className="text-lg font-semibold text-foreground">Bảng đặt hàng</h2>
                  <p className="text-sm text-muted-foreground">{orderDate}</p>
                </div>

                <div className="overflow-visible rounded-xl border border-border">
                  <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th className="sticky left-0 top-14 z-40 min-w-48 border-b border-r border-border bg-card px-3 py-2 text-left font-semibold text-foreground">
                          Mặt hàng
                        </th>
                        <th className="sticky top-14 z-30 min-w-16 border-b border-r border-border bg-secondary px-3 py-2 text-center font-semibold text-secondary-foreground">
                          ĐVT
                        </th>
                        {matrix.columns.map((col) => {
                          const tint = COLUMN_TINTS[col.styleIdx % COLUMN_TINTS.length];
                          return (
                            <th
                              key={col.key}
                              className={cn(
                                "sticky top-14 z-30 min-w-36 border-b border-r border-border px-3 py-2 text-center font-semibold last:border-r-0",
                                tint,
                              )}
                            >
                              <div className="text-xs font-medium opacity-80">{col.refLabel}</div>
                              <div>{col.recipientUnitName}</div>
                            </th>
                          );
                        })}
                        <th className="sticky top-14 z-30 border-b border-border bg-muted px-3 py-2 text-center font-semibold text-foreground">
                          Tổng
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.rows.map((row) => (
                        <tr key={row.commodityId}>
                          <td className="sticky left-0 z-20 border-r border-t border-border bg-card px-3 py-2 text-foreground">
                            {row.name}
                          </td>
                          <td className="border-r border-t border-border bg-secondary/70 px-3 py-2 text-center text-secondary-foreground">
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
                className="relative flex h-dvh w-full flex-col overflow-hidden bg-card sm:h-[min(90dvh,40rem)] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-border sm:shadow-lg"
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
    </div>
  );
}
