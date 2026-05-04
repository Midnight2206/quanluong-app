"use client";

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { ClipboardCopy, ImageIcon, Printer } from "lucide-react";
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

/** Quyển + số phiếu — nhãn phân biệt khi cùng đơn vị nhiều phiếu. */
function slipRefLabel(bookMmyy, slipNo) {
  const sn = slipNo != null && Number.isFinite(Number(slipNo)) ? String(Number(slipNo)).padStart(4, "0") : "—";
  const b = bookMmyy != null && String(bookMmyy).trim() !== "" ? String(bookMmyy).trim() : "—";
  return `Q.${b}-${sn}`;
}

/** Tránh nhầm khi copy: tên không chứa `:` hay `;` hay xuống dòng. */
function sanitizeOrderTextToken(s) {
  return String(s ?? "")
    .replace(/[\r\n:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mỗi phiếu: dòng 1 = đơn vị nhận + số phiếu (+ chú thích); dòng 2 = `mặt1:sl;mặt2:sl`.
 * Các phiếu liền nhau, cách nhau bằng một `\n` (khối 2 dòng → giữa hai phiếu là một dòng trống nếu ghép `\n` + `\n`).
 * Ở đây ghép bằng `\n` giữa từng khối 2 dòng → giữa phiếu A (hết dòng 2) và phiếu B (dòng 1) chỉ một xuống dòng.
 */
function buildOrderSharePlainText({ orderDate, storageUnitName, supplierFilterLabel, slipColumns }) {
  if (!Array.isArray(slipColumns) || slipColumns.length === 0) {
    return "";
  }
  const meta = [
    `Tổng hợp đặt hàng LTTP — ${orderDate}`,
    storageUnitName ? `Kho cấp phát: ${storageUnitName}` : null,
    `Lọc đối tác (dòng phiếu): ${supplierFilterLabel}`,
  ].filter(Boolean);

  const slipBlocks = slipColumns.map((col) => {
    const refLabel = slipRefLabel(col.bookMmyy, col.slipNo);
    const caption =
      col.note != null && String(col.note).trim() !== "" ? String(col.note).trim().replace(/[\r\n]+/g, " ") : null;
    const head = caption
      ? `${sanitizeOrderTextToken(col.recipientUnitName)} | ${refLabel} (${caption})`
      : `${sanitizeOrderTextToken(col.recipientUnitName)} | ${refLabel}`;
    const pairs = (col.lines || [])
      .filter((ln) => {
        const q = Number(ln.quantity);
        return Number.isFinite(q) && q !== 0;
      })
      .map((ln) => {
        const nm = sanitizeOrderTextToken(ln.name);
        const qf = String(ln.quantityFormatted ?? "").trim() || "0";
        return `${nm}:${qf}`;
      })
      .join(";");
    return pairs ? `${head}\n${pairs}` : `${head}\n`;
  });

  return `${meta.join("\n")}\n\n${slipBlocks.join("\n")}`;
}

/**
 * Giàn màu cột phiếu (nền + viền trái) — tương thích sáng/tối, in vẫn nhìn phân nhánh.
 */
const SLIP_COLUMN_STYLES = [
  { bar: "bg-sky-500", cell: "bg-sky-500/[0.09] dark:bg-sky-500/15 border-sky-500/25" },
  { bar: "bg-violet-500", cell: "bg-violet-500/[0.09] dark:bg-violet-500/15 border-violet-500/25" },
  { bar: "bg-emerald-500", cell: "bg-emerald-500/[0.09] dark:bg-emerald-500/15 border-emerald-500/25" },
  { bar: "bg-amber-500", cell: "bg-amber-500/[0.09] dark:bg-amber-500/15 border-amber-500/25" },
  { bar: "bg-rose-500", cell: "bg-rose-500/[0.09] dark:bg-rose-500/15 border-rose-500/25" },
  { bar: "bg-cyan-500", cell: "bg-cyan-500/[0.09] dark:bg-cyan-500/15 border-cyan-500/25" },
  { bar: "bg-orange-500", cell: "bg-orange-500/[0.09] dark:bg-orange-500/15 border-orange-500/25" },
  { bar: "bg-fuchsia-500", cell: "bg-fuchsia-500/[0.09] dark:bg-fuchsia-500/15 border-fuchsia-500/25" },
];

/**
 * Tab «Đặt hàng»: bảng ma trận mặt hàng × từng phiếu xuất trong ngày, màu phân cột.
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
    if (!summary?.grandTotals?.length && !summary?.slipColumns?.length) {
      return null;
    }

    const slips = [...(summary.slipColumns || [])];

    /** @type {{ key: string; slipId: number; recipientUnitName: string; caption: string|null; refLabel: string; styleIdx: number }[]} */
    const columns = slips.map((col, i) => ({
      key: `slip-${col.slipId}`,
      slipId: col.slipId,
      recipientUnitName: col.recipientUnitName,
      caption: col.note != null && String(col.note).trim() !== "" ? String(col.note).trim() : null,
      refLabel: slipRefLabel(col.bookMmyy, col.slipNo),
      styleIdx: i % SLIP_COLUMN_STYLES.length,
    }));

    const rows = [...(summary.grandTotals || [])].sort((a, b) => a.name.localeCompare(b.name, "vi"));

    const qtyBySlip = new Map();
    for (const s of slips) {
      const k = `slip-${s.slipId}`;
      const m = new Map();
      for (const line of s.lines || []) {
        m.set(line.commodityId, line.quantityFormatted);
      }
      qtyBySlip.set(k, m);
    }

    return { columns, rows, qtyBySlip };
  }, [summary]);

  const supplierFilterLabel = useMemo(() => {
    if (!summary?.supplierFilter) return "Tất cả đối tác";
    if (summary.supplierFilter === "all") return "Tất cả đối tác";
    if (summary.supplierFilter === "none") return "Chưa gán đối tác trên dòng phiếu";
    const sid = summary.supplierFilter;
    const row = summary.availableSuppliers?.find((s) => s.id != null && Number(s.id) === Number(sid));
    return row?.name ?? `Đối tác #${sid}`;
  }, [summary]);

  const orderSharePlainText = useMemo(() => {
    if (!summary?.slipColumns?.length) {
      return "";
    }
    return buildOrderSharePlainText({
      orderDate,
      storageUnitName: summary.storageUnitName ?? storageUnitName ?? null,
      supplierFilterLabel,
      slipColumns: summary.slipColumns,
    });
  }, [summary, orderDate, storageUnitName, supplierFilterLabel]);

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
  const canCopyText = Boolean(orderSharePlainText) && !showLoader && effectiveUnitId != null;

  const handleCopyOrderText = useCallback(async () => {
    if (!orderSharePlainText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(orderSharePlainText);
      notifySuccess("Đã copy vào clipboard.");
    } catch {
      notifyError("Trình duyệt không cho phép copy — chọn văn bản trong ô và copy thủ công (Ctrl+C).");
    }
  }, [orderSharePlainText]);

  if (effectiveUnitId == null) {
    return <p className="text-xs text-destructive">Chưa có đơn vị kho — gán đơn vị cho tài khoản.</p>;
  }

  return (
    <div className="min-w-0 space-y-4 pb-2 print:pb-4" aria-busy={showLoader}>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Mỗi <span className="font-medium text-foreground">phiếu xuất</span> trong ngày là một cột — cùng đơn vị nhận nhưng nhiều phiếu sẽ có nhiều cột. Dòng hai tiêu đề cột là{" "}
        <span className="font-medium text-foreground">chú thích phiếu</span> (nhập khi viết phiếu). Chỉ tính các dòng khớp{" "}
        <span className="font-medium text-foreground">đối tác cung cấp</span> khi bạn chọn lọc.
      </p>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/50 p-3 shadow-sm lg:flex-row lg:flex-wrap lg:items-end print:hidden">
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
        <div className="flex w-full shrink-0 flex-row flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="h-9 shrink-0 gap-2 text-xs"
            disabled={!canExportPng || pngExporting}
            onClick={handleExportPngForZalo}
          >
            <ImageIcon className="size-3.5 shrink-0" />
            {pngExporting ? "Đang tạo ảnh…" : "Ảnh PNG (gửi Zalo)"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 gap-2 text-xs"
            disabled={!canCopyText}
            title="Định dạng: mỗi phiếu hai dòng (đơn vị|số phiếu, rồi mặt:SL;…); phiếu liền nhau."
            onClick={() => void handleCopyOrderText()}
          >
            <ClipboardCopy className="size-3.5 shrink-0" />
            Copy text đặt hàng
          </Button>
          <Button type="button" variant="secondary" className="h-9 shrink-0 gap-2 text-xs" onClick={handlePrint}>
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
          "space-y-6 rounded-2xl border border-border/60 bg-gradient-to-b from-card/80 to-card/40 px-3 py-4 shadow-sm sm:px-4 sm:py-6",
          "print:border-0 print:bg-white print:p-0 print:shadow-none",
        )}
      >
        <header className="border-b border-border/80 pb-4 text-center print:border-border">
          <p className="text-balance text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Tổng hợp đặt hàng
          </p>
          <p className="mt-1 text-balance text-lg font-semibold text-foreground sm:text-xl">{formatViDate(orderDate)}</p>
          <p className="mt-2 text-balance break-words text-sm text-muted-foreground">
            Kho cấp phát:{" "}
            <span className="font-medium text-foreground">{summary?.storageUnitName ?? storageUnitName ?? `#${effectiveUnitId}`}</span>
          </p>
          {summary != null ? (
            <>
            <p className="mt-1 break-words rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              Đang lọc đối tác: <span className="font-semibold text-foreground">{supplierFilterLabel}</span>
            </p>
            <p className="mt-1 text-balance text-xs text-muted-foreground">
              {summary.slipCount === 0
                ? "Không có dòng phiếu khớp bộ lọc trong ngày."
                : `${summary.slipCount} phiếu có ít nhất một dòng khớp${typeof summary.totalSlipsOnDate === "number" ? ` — ${summary.totalSlipsOnDate} phiếu trong ngày (tổng)` : ""} — ${matrix?.columns?.length ?? 0} cột.`}
            </p>
          </>
          ) : null}
        </header>

        {showLoader ? <p className="text-center text-sm text-muted-foreground">Đang tải dữ liệu…</p> : null}

        {!showLoader && matrix && matrix.columns.length > 0 && matrix.rows.length > 0 ? (
          <Card
            data-lttp-ordering-card
            className="-mx-3 w-[calc(100%+1.5rem)] overflow-hidden border-border/80 shadow-md sm:-mx-4 sm:w-[calc(100%+2rem)] print:mx-0 print:w-full print:break-inside-avoid"
          >
            <div className="border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2.5 sm:px-4">
              <h2 className="text-balance text-xs font-semibold uppercase tracking-wide text-foreground">Bảng đặt hàng theo phiếu</h2>
              <p className="mt-0.5 text-balance text-[10px] text-muted-foreground">
                Bảng dùng hết chiều ngang khi đủ chỗ; cuộn ngang chỉ khi nhiều phiếu hoặc màn hình hẹp — cột STT / mặt hàng / ĐVT cố định khi cuộn.
              </p>
            </div>
            <CardContent className="!p-0">
              <div data-lttp-ordering-table-scroll className="min-w-0 overflow-x-auto overflow-y-visible">
                <table className="w-full min-w-0 table-fixed border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th
                        scope="col"
                        className="sticky left-0 z-20 w-9 min-w-9 max-w-9 border-b border-r border-border bg-muted/95 px-1 py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground backdrop-blur-sm print:relative print:bg-muted"
                      >
                        STT
                      </th>
                      <th
                        scope="col"
                        className="sticky left-9 z-20 w-32 min-w-32 max-w-32 border-b border-r border-border bg-muted/95 px-1.5 py-2 text-[10px] font-semibold uppercase text-muted-foreground backdrop-blur-sm print:relative print:bg-muted"
                      >
                        <span className="block break-words leading-tight">Tên mặt hàng</span>
                      </th>
                      <th
                        scope="col"
                        className="sticky left-[10.25rem] z-20 w-10 min-w-10 max-w-10 border-b border-r border-border bg-muted/95 px-0.5 py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground backdrop-blur-sm print:relative print:bg-muted"
                      >
                        ĐVT
                      </th>
                      {matrix.columns.map((col) => {
                        const tint = SLIP_COLUMN_STYLES[col.styleIdx];
                        return (
                          <th
                            key={col.key}
                            scope="col"
                            className={cn(
                              "min-w-0 border-b border-l border-border/60 px-1 py-1.5 align-top",
                              tint.cell,
                            )}
                          >
                            <div className={cn("mb-1 h-1 w-full rounded-sm", tint.bar)} aria-hidden />
                            <div className="break-words px-0.5 text-center text-[10px] font-medium leading-snug tabular-nums text-muted-foreground">
                              {col.refLabel}
                            </div>
                            <div className="mt-1 break-words px-0.5 text-center text-[11px] font-semibold leading-snug text-foreground">
                              {col.recipientUnitName}
                            </div>
                            <div className="mt-1 break-words px-0.5 pb-0.5 text-center text-[10px] leading-snug text-muted-foreground">
                              {col.caption != null ? <span>({col.caption})</span> : <span className="italic opacity-75">—</span>}
                            </div>
                          </th>
                        );
                      })}
                      <th
                        scope="col"
                        className="w-14 min-w-14 max-w-[4.5rem] border-b border-l-2 border-primary/40 bg-primary/12 px-1 py-2 text-center text-[10px] font-bold uppercase text-primary"
                      >
                        Tổng
                        <br />
                        <span className="font-normal text-muted-foreground">(ngày)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((row, i) => (
                      <tr key={row.commodityId} className="border-b border-border/50">
                        <td
                          className={cn(
                            "sticky left-0 z-10 w-9 min-w-9 max-w-9 border-r border-border px-1 py-2 text-center text-xs text-muted-foreground print:relative",
                            i % 2 === 0 ? "bg-background" : "bg-muted/30",
                          )}
                        >
                          {i + 1}
                        </td>
                        <td
                          className={cn(
                            "sticky left-9 z-10 w-32 min-w-32 max-w-32 border-r border-border px-1.5 py-2 text-xs font-medium leading-snug text-foreground print:relative",
                            i % 2 === 0 ? "bg-background" : "bg-muted/30",
                          )}
                        >
                          <span className="block break-words">{row.name}</span>
                        </td>
                        <td
                          className={cn(
                            "sticky left-[10.25rem] z-10 w-10 min-w-10 max-w-10 border-r border-border px-0.5 py-2 text-center text-xs text-muted-foreground print:relative",
                            i % 2 === 0 ? "bg-background" : "bg-muted/30",
                          )}
                        >
                          <span className="block break-words leading-tight">{row.measureUnit || "—"}</span>
                        </td>
                        {matrix.columns.map((col) => {
                          const tint = SLIP_COLUMN_STYLES[col.styleIdx];
                          const cell = matrix.qtyBySlip.get(col.key);
                          const val = cell?.get(row.commodityId);
                          return (
                            <td
                              key={`${row.commodityId}-${col.key}`}
                              className={cn(
                                "min-w-0 border-l border-border/50 px-1 py-2 text-right text-xs tabular-nums",
                                tint.cell,
                                !val || val === "0" ? "text-muted-foreground/70" : "font-medium text-foreground",
                              )}
                            >
                              {val ?? "—"}
                            </td>
                          );
                        })}
                        <td className="w-14 min-w-14 max-w-[4.5rem] border-l-2 border-primary/30 bg-primary/[0.07] px-1 py-2 text-right text-xs font-semibold tabular-nums text-primary">
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
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/50 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm"
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", SLIP_COLUMN_STYLES[col.styleIdx].bar)} aria-hidden />
                      <span className="min-w-0 break-words">
                        {col.refLabel} · {col.recipientUnitName}
                      </span>
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
              Có phiếu nhưng không có cột phiếu sau lọc — kiểm tra đối tác trên từng dòng và dữ liệu phiếu.
            </CardContent>
          </Card>
        ) : null}

        {!showLoader && summary && summary.slipCount === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">Không có phiếu xuất cho ngày đã chọn.</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Lập phiếu ở tab <span className="font-medium text-foreground">Phiếu xuất</span> (mục Nhập xuất LTTP). Đặt <span className="font-medium text-foreground">chú thích phiếu</span> trong form để hiển thị dưới tên đơn vị ở tab Đặt hàng.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
