"use client";

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { ImageIcon, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useGetLttpDailyOrderSummaryQuery } from "@/features/lttp/api/lttpApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { captureElementToPngBlob, shareOrDownloadPng } from "@/utils/captureElementToPng";
import { cn } from "@/utils/cn";

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatViDate(ymd) {
  if (!ymd || typeof ymd !== "string") return "";
  const [y, mo, da] = ymd.split("-").map(Number);
  if (!y || !mo || !da) return ymd;
  try {
    return new Date(y, mo - 1, da).toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return ymd;
  }
}

/**
 * Giàn màu cột đơn vị (nền + viền trái) — tương thích sáng/tối, in vẫn nhìn phân nhánh.
 */
const UNIT_COLUMN_STYLES = [
  { bar: "bg-sky-500", cell: "bg-sky-500/[0.09] dark:bg-sky-500/15 border-sky-500/25" },
  { bar: "bg-violet-500", cell: "bg-violet-500/[0.09] dark:bg-violet-500/15 border-violet-500/25" },
  { bar: "bg-emerald-500", cell: "bg-emerald-500/[0.09] dark:bg-emerald-500/15 border-emerald-500/25" },
  { bar: "bg-amber-500", cell: "bg-amber-500/[0.09] dark:bg-amber-500/15 border-amber-500/25" },
  { bar: "bg-rose-500", cell: "bg-rose-500/[0.09] dark:bg-rose-500/15 border-rose-500/25" },
  { bar: "bg-cyan-500", cell: "bg-cyan-500/[0.09] dark:bg-cyan-500/15 border-cyan-500/25" },
  { bar: "bg-orange-500", cell: "bg-orange-500/[0.09] dark:bg-orange-500/15 border-orange-500/25" },
  { bar: "bg-fuchsia-500", cell: "bg-fuchsia-500/[0.09] dark:bg-fuchsia-500/15 border-fuchsia-500/25" },
];

function recipientColKey(unitId) {
  return unitId == null ? "__none__" : String(unitId);
}

/**
 * Tab «Đặt hàng»: bảng ma trận mặt hàng × đơn vị nhận, màu phân nhánh.
 */
export function LttpOrderingTab({ effectiveUnitId, storageUnitName }) {
  const orderCaptureRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [orderDate, setOrderDate] = useState(() => todayIsoDate());
  /** Chuỗi gửi API: `all` | `none` | id đối tác (số trong danh mục kho). */
  const [supplierFilterKey, setSupplierFilterKey] = useState(() => "all");
  const [pngExporting, setPngExporting] = useState(false);

  const { data: summary, isLoading, isFetching, error } = useGetLttpDailyOrderSummaryQuery(
    { unitId: effectiveUnitId, date: orderDate, supplierFilter: supplierFilterKey },
    { skip: effectiveUnitId == null },
  );

  useEffect(() => {
    const list = summary?.availableSuppliers ?? [];
    if (!list.length || supplierFilterKey === "all" || supplierFilterKey === "none") {
      return;
    }
    const id = Number(supplierFilterKey);
    const ok = list.some((s) => s.id != null && Number(s.id) === id);
    if (!ok) {
      setSupplierFilterKey("all");
    }
  }, [summary?.availableSuppliers, supplierFilterKey]);

  const matrix = useMemo(() => {
    if (!summary?.grandTotals?.length && !summary?.recipientGroups?.length) {
      return null;
    }

    const groups = [...(summary.recipientGroups || [])].sort((a, b) =>
      a.recipientUnitName.localeCompare(b.recipientUnitName, "vi"),
    );

    /** @type {{ key: string, unitId: number|null, name: string, notes: string[], styleIdx: number }[]} */
    const columns = groups.map((g, i) => ({
      key: recipientColKey(g.recipientUnitId),
      unitId: g.recipientUnitId,
      name: g.recipientUnitName,
      notes: g.slipNotes || [],
      styleIdx: i % UNIT_COLUMN_STYLES.length,
    }));

    const rows = [...(summary.grandTotals || [])].sort((a, b) => a.name.localeCompare(b.name, "vi"));

    const qtyByRecipient = new Map();
    for (const g of groups) {
      const k = recipientColKey(g.recipientUnitId);
      const m = new Map();
      for (const line of g.lines || []) {
        m.set(line.commodityId, line.quantityFormatted);
      }
      qtyByRecipient.set(k, m);
    }

    return { columns, rows, qtyByRecipient };
  }, [summary]);

  const supplierFilterLabel = useMemo(() => {
    if (!summary?.supplierFilter) return "Tất cả đối tác";
    if (summary.supplierFilter === "all") return "Tất cả đối tác";
    if (summary.supplierFilter === "none") return "Chưa gán đối tác trên dòng phiếu";
    const sid = summary.supplierFilter;
    const row = summary.availableSuppliers?.find((s) => s.id != null && Number(s.id) === Number(sid));
    return row?.name ?? `Đối tác #${sid}`;
  }, [summary]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  const handleExportPngForZalo = useCallback(async () => {
    const el = orderCaptureRef.current;
    if (!el || pngExporting || isLoading || isFetching || !matrix?.rows?.length) return;
    setPngExporting(true);
    try {
      const blob = await captureElementToPngBlob(el);
      const filename = `dat-hang-lttp-${orderDate}.png`;
      const outcome = await shareOrDownloadPng(blob, filename);
      if (outcome === "shared") {
        notifySuccess("Đã mở chia sẻ — chọn Zalo hoặc ứng dụng khác.");
      } else if (outcome === "downloaded") {
        notifySuccess("Đã tải ảnh — mở Zalo và đính kèm file vừa tải.");
      }
    } catch (e) {
      const msg = typeof e?.message === "string" ? e.message : null;
      notifyError(msg || "Không tạo được ảnh. Thử đóng bớt cửa sổ và thử lại.");
    } finally {
      setPngExporting(false);
    }
  }, [pngExporting, isLoading, isFetching, matrix?.rows?.length, orderDate]);

  const showLoader = isLoading || isFetching;
  const canExportPng =
    Boolean(matrix?.columns?.length && matrix?.rows?.length) && !showLoader && effectiveUnitId != null;

  if (effectiveUnitId == null) {
    return <p className="text-xs text-destructive">Chưa có đơn vị kho — gán đơn vị cho tài khoản.</p>;
  }

  return (
    <div className="min-w-0 space-y-4 pb-2 print:pb-4" aria-busy={showLoader}>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Bảng gộp số lượng theo <span className="font-medium text-foreground">đơn vị nhận</span> — chỉ tính các dòng phiếu xuất
        khớp <span className="font-medium text-foreground">đối tác cung cấp</span> (trên từng dòng) khi bạn chọn lọc bên dưới.
      </p>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/50 p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end print:hidden">
        <label className="min-w-[180px] flex-1 space-y-1" htmlFor="lttp-ordering-date">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Ngày đặt</span>
          <input
            id="lttp-ordering-date"
            type="date"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value || todayIsoDate())}
          />
        </label>
        <label className="min-w-[220px] flex-1 space-y-1" htmlFor="lttp-ordering-supplier">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Đối tác cung cấp (dòng phiếu)</span>
          <select
            id="lttp-ordering-supplier"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
            value={supplierFilterKey}
            onChange={(e) => setSupplierFilterKey(e.target.value)}
          >
            <option value="all">Tất cả — gộp mọi dòng</option>
            {(summary?.availableSuppliers ?? []).some((s) => s.id == null) ? (
              <option value="none">Chưa gán đối tác (dòng không chọn nhà cung cấp)</option>
            ) : null}
            {(summary?.availableSuppliers ?? [])
              .filter((s) => s.id != null)
              .map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name ?? `Đối tác #${s.id}`}
                </option>
              ))}
          </select>
        </label>
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-nowrap">
          <Button type="button" variant="ghost" className="h-9 w-full gap-2 text-xs" disabled={!canExportPng || pngExporting} onClick={handleExportPngForZalo}>
            <ImageIcon className="size-3.5 shrink-0" />
            {pngExporting ? "Đang tạo ảnh…" : "Ảnh PNG (gửi Zalo)"}
          </Button>
          <Button type="button" variant="secondary" className="h-9 w-full gap-2 text-xs" onClick={handlePrint}>
            <Printer className="size-3.5" />
            In / PDF
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          {typeof error?.data?.message === "string"
            ? error.data.message
            : "Không tải được tổng hợp. Thử lại hoặc kiểm tra quyền đơn vị."}
        </p>
      ) : null}

      <div
        ref={orderCaptureRef}
        id="lttp-daily-order-print"
        className={cn(
          "space-y-6 rounded-2xl border border-border/60 bg-gradient-to-b from-card/80 to-card/40 p-4 shadow-sm sm:p-6",
          "print:border-0 print:bg-white print:p-0 print:shadow-none",
        )}
      >
        <header className="border-b border-border/80 pb-4 text-center print:border-border">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tổng hợp đặt hàng</p>
          <p className="mt-1 text-lg font-semibold text-foreground sm:text-xl">{formatViDate(orderDate)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Kho cấp phát:{" "}
            <span className="font-medium text-foreground">{summary?.storageUnitName ?? storageUnitName ?? `#${effectiveUnitId}`}</span>
          </p>
          {summary != null ? (
            <>
            <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              Đang lọc đối tác: <span className="font-semibold text-foreground">{supplierFilterLabel}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.slipCount === 0
                ? "Không có dòng phiếu khớp bộ lọc trong ngày."
                : `${summary.slipCount} phiếu có ít nhất một dòng khớp${typeof summary.totalSlipsOnDate === "number" ? ` — ${summary.totalSlipsOnDate} phiếu trong ngày (tổng)` : ""} — ${matrix?.columns?.length ?? 0} đơn vị nhận.`}
            </p>
          </>
          ) : null}
        </header>

        {showLoader ? <p className="text-center text-sm text-muted-foreground">Đang tải dữ liệu…</p> : null}

        {!showLoader && matrix && matrix.columns.length > 0 && matrix.rows.length > 0 ? (
          <Card data-lttp-ordering-card className="overflow-hidden border-border/80 shadow-md print:break-inside-avoid">
            <div className="border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">Bảng đặt hàng theo đơn vị nhận</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Cuộn ngang nếu nhiều đơn vị — cột đầu (mặt hàng) luôn cố định khi cuộn.</p>
            </div>
            <CardContent className="!p-0">
              <div data-lttp-ordering-table-scroll className="overflow-x-auto overflow-y-visible">
                <table className="w-max min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-20 min-w-[2.5rem] border-b border-r border-border bg-muted/95 px-2 py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground backdrop-blur-sm print:relative print:bg-muted"
                      >
                        STT
                      </th>
                      <th
                        rowSpan={2}
                        className="sticky left-[2.5rem] z-20 min-w-[11rem] max-w-[14rem] border-b border-r border-border bg-muted/95 px-2 py-2 text-[10px] font-semibold uppercase text-muted-foreground backdrop-blur-sm print:relative print:bg-muted"
                      >
                        Tên mặt hàng
                      </th>
                      <th
                        rowSpan={2}
                        className="sticky left-[calc(2.5rem+11rem)] z-20 min-w-[4rem] border-b border-r border-border bg-muted/95 px-2 py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground backdrop-blur-sm print:relative print:bg-muted"
                      >
                        ĐVT
                      </th>
                      {matrix.columns.map((col) => {
                        const tint = UNIT_COLUMN_STYLES[col.styleIdx];
                        return (
                          <th
                            key={col.key}
                            className={cn(
                              "min-w-[7.5rem] max-w-[12rem] border-b border-l border-border/60 px-1.5 py-0 align-bottom",
                              tint.cell,
                            )}
                          >
                            <div className={cn("mb-1 h-1 w-full rounded-sm", tint.bar)} aria-hidden />
                            <div className="px-0.5 pb-1 text-center text-[11px] font-semibold leading-tight text-foreground">
                              {col.name}
                            </div>
                          </th>
                        );
                      })}
                      <th
                        rowSpan={2}
                        className="min-w-[5rem] border-b border-l-2 border-primary/40 bg-primary/12 px-2 py-2 text-center text-[10px] font-bold uppercase text-primary"
                      >
                        Tổng
                        <br />
                        <span className="font-normal text-muted-foreground">(ngày)</span>
                      </th>
                    </tr>
                    <tr className="border-b border-border">
                      {matrix.columns.map((col) => {
                        const tint = UNIT_COLUMN_STYLES[col.styleIdx];
                        return (
                          <th
                            key={`${col.key}-notes`}
                            className={cn(
                              "max-w-[12rem] border-b border-l border-border/50 px-1.5 pb-2 align-top font-normal",
                              tint.cell,
                            )}
                          >
                            {col.notes.length > 0 ? (
                              <ul className="mx-auto max-h-16 max-w-full list-none space-y-0.5 overflow-y-auto text-[9px] leading-snug text-muted-foreground">
                                {col.notes.map((n) => (
                                  <li key={n} className="rounded bg-background/60 px-1 py-0.5 text-left ring-1 ring-border/40">
                                    {n}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="block text-center text-[9px] italic text-muted-foreground/80">—</span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((row, i) => (
                      <tr key={row.commodityId} className="border-b border-border/50">
                        <td
                          className={cn(
                            "sticky left-0 z-10 border-r border-border px-2 py-2 text-center text-xs text-muted-foreground print:relative",
                            i % 2 === 0 ? "bg-background" : "bg-muted/30",
                          )}
                        >
                          {i + 1}
                        </td>
                        <td
                          className={cn(
                            "sticky left-[2.5rem] z-10 max-w-[14rem] border-r border-border px-2 py-2 text-xs font-medium leading-snug text-foreground print:relative",
                            i % 2 === 0 ? "bg-background" : "bg-muted/30",
                          )}
                        >
                          {row.name}
                        </td>
                        <td
                          className={cn(
                            "sticky left-[calc(2.5rem+11rem)] z-10 min-w-[4rem] border-r border-border px-1 py-2 text-center text-xs text-muted-foreground print:relative",
                            i % 2 === 0 ? "bg-background" : "bg-muted/30",
                          )}
                        >
                          {row.measureUnit || "—"}
                        </td>
                        {matrix.columns.map((col) => {
                          const tint = UNIT_COLUMN_STYLES[col.styleIdx];
                          const cell = matrix.qtyByRecipient.get(col.key);
                          const val = cell?.get(row.commodityId);
                          return (
                            <td
                              key={`${row.commodityId}-${col.key}`}
                              className={cn(
                                "border-l border-border/50 px-1.5 py-2 text-right text-xs tabular-nums",
                                tint.cell,
                                !val || val === "0" ? "text-muted-foreground/70" : "font-medium text-foreground",
                              )}
                            >
                              {val ?? "—"}
                            </td>
                          );
                        })}
                        <td className="border-l-2 border-primary/30 bg-primary/[0.07] px-2 py-2 text-right text-xs font-semibold tabular-nums text-primary">
                          {row.quantityFormatted}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 bg-muted/25 px-3 py-2.5 print:break-inside-avoid">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Chú thích màu:</span>
                <ul className="flex flex-1 flex-wrap gap-2">
                  {matrix.columns.map((col) => (
                    <li
                      key={`legend-${col.key}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm"
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", UNIT_COLUMN_STYLES[col.styleIdx].bar)} aria-hidden />
                      {col.name}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!showLoader && summary && matrix && matrix.columns.length === 0 && summary.slipCount > 0 ? (
          <Card className="border-amber-500/25 bg-amber-500/[0.06]">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Có phiếu nhưng không gom được cột đơn vị nhận — kiểm tra dữ liệu phiếu.
            </CardContent>
          </Card>
        ) : null}

        {!showLoader && summary && summary.slipCount === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">Không có phiếu xuất cho ngày đã chọn.</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Lập phiếu ở tab <span className="font-medium text-foreground">Phiếu xuất</span> (mục Nhập xuất LTTP).
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
