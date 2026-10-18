"use client";

import { useMemo, useCallback, useState, useEffect, useLayoutEffect, useRef, memo } from "react";
import { ChevronLeft, ChevronRight, ClipboardCopy, ImageIcon, X } from "lucide-react";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useGetLttpDailyOrderSummaryQuery } from "@/features/lttp/api/lttpApi";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import { notifyError, notifySuccess, notifyWarning } from "@/services/notify";
import { captureElementToPngBlob, shareOrDownloadPng } from "@/utils/captureElementToPng";
import { cn } from "@/utils/cn";
import {
  buildOrderingMatrix,
  buildOrderSharePlainText,
  orderSupplierFilterLabel,
} from "./lttpOrderingMatrix.js";

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
 * Giàn màu cột phiếu (nền + viền trái) — tương thích sáng/tối, in vẫn nhìn phân nhánh.
 */

const SLIP_COLUMN_STYLES = [
  { bar: "bg-sky-500", cell: "bg-sky-500/[0.09] border-info/25" },
  { bar: "bg-violet-500", cell: "bg-violet-500/[0.09] dark:bg-violet-500/15 border-violet-500/25" },
  { bar: "bg-emerald-500", cell: "bg-emerald-500/[0.09] border-success/25" },
  { bar: "bg-amber-500", cell: "bg-amber-500/[0.09] border-warning/25" },
  { bar: "bg-rose-500", cell: "bg-rose-500/[0.09] dark:bg-rose-500/15 border-rose-500/25" },
  { bar: "bg-cyan-500", cell: "bg-cyan-500/[0.09] dark:bg-cyan-500/15 border-cyan-500/25" },
  { bar: "bg-orange-500", cell: "bg-orange-500/[0.09] dark:bg-orange-500/15 border-orange-500/25" },
  { bar: "bg-fuchsia-500", cell: "bg-fuchsia-500/[0.09] dark:bg-fuchsia-500/15 border-fuchsia-500/25" },
];

/** Một nguồn sự thật cho width + sticky-left để header/body luôn thẳng hàng. */
const ORDER_COLUMN_PX = {
  index: 40,
  name: 208,
  unit: 44,
  slip: 65,
  total: 84,
};

const ORDER_STICKY_LEFT_PX = {
  index: 0,
  name: ORDER_COLUMN_PX.index,
  unit: ORDER_COLUMN_PX.index + ORDER_COLUMN_PX.name,
};

const ORDER_COL_STYLE = {
  index: { width: ORDER_COLUMN_PX.index, minWidth: ORDER_COLUMN_PX.index, maxWidth: ORDER_COLUMN_PX.index },
  name: { width: ORDER_COLUMN_PX.name, minWidth: ORDER_COLUMN_PX.name, maxWidth: ORDER_COLUMN_PX.name },
  unit: { width: ORDER_COLUMN_PX.unit, minWidth: ORDER_COLUMN_PX.unit, maxWidth: ORDER_COLUMN_PX.unit },
  slip: { width: ORDER_COLUMN_PX.slip, minWidth: ORDER_COLUMN_PX.slip, maxWidth: ORDER_COLUMN_PX.slip },
  total: { width: ORDER_COLUMN_PX.total, minWidth: ORDER_COLUMN_PX.total, maxWidth: ORDER_COLUMN_PX.total },
};

/**
 * Mobile: một cột phiếu (đơn vị nhận) mỗi lần, nút qua lại — tránh vuốt ngang bảng rộng.
 * @param {{
 *   columns: { key: string; styleIdx: number; refLabel: string; recipientUnitName: string; caption: string | null }[];
 *   rows: { commodityId: number; name: string; measureUnit?: string | null; quantityFormatted?: string | null }[];
 *   qtyBySlip: Map<string, Map<number, { quantityFormatted: string; lineNote: string | null }>>;
 *   activeIndex: number;
 *   onActiveIndexChange: (next: number) => void;
 * }} props
 */
const LttpOrderingMobileUnitPager = memo(function LttpOrderingMobileUnitPager({
  columns,
  rows,
  qtyBySlip,
  activeIndex,
  onActiveIndexChange,
}) {
  const total = columns.length;
  const safeIndex = total === 0 ? 0 : Math.min(Math.max(activeIndex, 0), total - 1);
  const col = columns[safeIndex];
  if (!col) return null;
  const tint = SLIP_COLUMN_STYLES[col.styleIdx];
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < total - 1;

  return (
    <div className="space-y-3" data-lttp-ordering-mobile-pager>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-10 shrink-0 px-0"
          disabled={!canPrev}
          aria-label="Đơn vị trước"
          onClick={() => onActiveIndexChange(safeIndex - 1)}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <label className="min-w-0 flex-1 space-y-1">
          <span className="sr-only">Chọn đơn vị nhận</span>
          <select
            className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium outline-none focus:border-primary"
            value={String(safeIndex)}
            onChange={(e) => onActiveIndexChange(Number(e.target.value))}
            aria-label="Chọn đơn vị nhận"
          >
            {columns.map((c, i) => (
              <option key={c.key} value={String(i)}>
                {i + 1}/{total} — {c.recipientUnitName}
                {c.caption ? ` (${c.caption})` : ""}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-10 shrink-0 px-0"
          disabled={!canNext}
          aria-label="Đơn vị sau"
          onClick={() => onActiveIndexChange(safeIndex + 1)}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className={cn("rounded-lg border border-border/70 px-3 py-2.5", tint.cell)}>
        <div className={cn("mb-2 h-1 w-full rounded-sm", tint.bar)} aria-hidden />
        <p className="text-center text-[11px] font-medium tabular-nums text-muted-foreground">{col.refLabel}</p>
        <p className="mt-1 text-center text-sm font-semibold leading-snug text-foreground">{col.recipientUnitName}</p>
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          {col.caption != null ? `(${col.caption})` : <span className="italic opacity-75">Không có chú thích</span>}
        </p>
      </div>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/80 bg-card">
        {rows.map((row, i) => {
          const cellData = qtyBySlip.get(col.key)?.get(row.commodityId);
          const val = cellData?.quantityFormatted;
          const lineNote = cellData?.lineNote;
          const hasQty = val != null && val !== "" && val !== "0";
          return (
            <li
              key={row.commodityId}
              className={cn("flex gap-2 px-3 py-2.5", i % 2 === 0 ? "bg-background" : "bg-muted/50")}
            >
              <span className="w-6 shrink-0 pt-0.5 text-center text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-foreground">{row.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  ĐVT: {row.measureUnit || "—"}
                  {row.quantityFormatted ? (
                    <span className="text-muted-foreground/80"> · Tổng ngày: {row.quantityFormatted}</span>
                  ) : null}
                </p>
                {lineNote ? (
                  <p className="mt-0.5 text-xs leading-snug text-foreground/85">({lineNote})</p>
                ) : null}
              </div>
              <span
                className={cn(
                  "shrink-0 self-center text-right text-base tabular-nums",
                  hasQty ? "font-semibold text-foreground" : "text-muted-foreground/70",
                )}
              >
                {val ?? "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

function orderingTablePixelWidth(slipColumnCount) {
  return (
    ORDER_COLUMN_PX.index +
    ORDER_COLUMN_PX.name +
    ORDER_COLUMN_PX.unit +
    slipColumnCount * ORDER_COLUMN_PX.slip +
    ORDER_COLUMN_PX.total
  );
}

/**
 * @param {{
 *   row: { commodityId: number; name: string; measureUnit?: string | null; quantityFormatted?: string | null };
 *   rowIndex: number;
 *   columns: { key: string; styleIdx: number }[];
 *   qtyBySlip: Map<string, Map<number, { quantityFormatted: string; lineNote: string | null }>>;
 *   freezeLeft?: boolean;
 * }} props
 */
const LttpOrderingMatrixRow = memo(function LttpOrderingMatrixRow({
  row,
  rowIndex,
  columns,
  qtyBySlip,
  freezeLeft = true,
}) {
  const i = rowIndex;
  const rowBg = i % 2 === 0 ? "bg-background" : "bg-muted/75";
  return (
    <tr className="border-b border-border/50">
      <td
        className={cn(
          "border-r border-border px-1.5 py-2.5 text-center text-sm text-muted-foreground tabular-nums",
          freezeLeft && "sticky z-20 print:relative",
          rowBg,
        )}
        style={
          freezeLeft
            ? { ...ORDER_COL_STYLE.index, left: ORDER_STICKY_LEFT_PX.index }
            : ORDER_COL_STYLE.index
        }
      >
        {i + 1}
      </td>
      <td
        className={cn(
          "border-r border-border px-2 py-2.5 text-sm font-medium leading-snug text-foreground",
          freezeLeft && "sticky z-20 print:relative",
          rowBg,
        )}
        style={
          freezeLeft
            ? { ...ORDER_COL_STYLE.name, left: ORDER_STICKY_LEFT_PX.name }
            : ORDER_COL_STYLE.name
        }
      >
        <span className="block break-words">{row.name}</span>
      </td>
      <td
        className={cn(
          "border-r border-border px-1 py-2.5 text-center text-sm text-muted-foreground",
          freezeLeft && "sticky z-20 print:relative",
          rowBg,
        )}
        style={
          freezeLeft
            ? { ...ORDER_COL_STYLE.unit, left: ORDER_STICKY_LEFT_PX.unit }
            : ORDER_COL_STYLE.unit
        }
      >
        <span className="block break-words leading-snug">{row.measureUnit || "—"}</span>
      </td>
      {columns.map((col) => {
        const tint = SLIP_COLUMN_STYLES[col.styleIdx];
        const cell = qtyBySlip.get(col.key);
        const cellData = cell?.get(row.commodityId);
        const val = cellData?.quantityFormatted;
        const lineNote = cellData?.lineNote;
        const hasQty = val != null && val !== "" && val !== "0";
        return (
          <td
            key={`${row.commodityId}-${col.key}`}
            className={cn(
              "border-l border-border/50 px-1.5 py-2.5 text-center text-sm whitespace-normal break-words",
              tint.cell,
              i % 2 === 0 ? "brightness-100" : "brightness-[0.78]",
              !hasQty && !lineNote ? "text-muted-foreground/70" : "text-foreground",
            )}
            style={ORDER_COL_STYLE.slip}
          >
            <span className={cn("block tabular-nums break-all", hasQty ? "font-medium" : "")}>{val ?? "—"}</span>
            {lineNote ? (
              <span className="mt-0.5 block break-words text-xs font-normal leading-snug text-foreground/85">
                {" "}
                ({lineNote})
              </span>
            ) : null}
          </td>
        );
      })}
      <td
        className={cn(
          "border-l-2 border-primary/30 bg-primary/[0.07] px-1.5 py-2.5 text-center text-sm font-semibold tabular-nums text-primary",
          i % 2 === 0 ? "brightness-100" : "brightness-[0.78]",
        )}
        style={ORDER_COL_STYLE.total}
      >
        {row.quantityFormatted}
      </td>
    </tr>
  );
});

/**
 * Một bảng HTML duy nhất — dùng cho StickyResponsiveTable (desktop) và bản phẳng (chụp PNG / in).
 * @param {{
 *   columns: { key: string; styleIdx: number; refLabel: string; recipientUnitName: string; caption: string | null }[];
 *   rows: { commodityId: number; name: string; measureUnit?: string | null; quantityFormatted?: string | null }[];
 *   qtyBySlip: Map<string, Map<number, { quantityFormatted: string; lineNote: string | null }>>;
 *   freezeLeft?: boolean;
 *   fixedPixelWidth?: boolean;
 * }} props
 */
const LttpOrderingMatrixTable = memo(function LttpOrderingMatrixTable({
  columns,
  rows,
  qtyBySlip,
  freezeLeft = true,
  fixedPixelWidth = false,
}) {
  const tablePx = orderingTablePixelWidth(columns.length);
  return (
    <table
      className="mb-px w-max min-w-full table-fixed border-separate border-spacing-0 text-center text-sm"
      style={fixedPixelWidth ? { width: tablePx, minWidth: tablePx } : undefined}
    >
      <colgroup>
        <col style={ORDER_COL_STYLE.index} />
        <col style={ORDER_COL_STYLE.name} />
        <col style={ORDER_COL_STYLE.unit} />
        {columns.map((col) => (
          <col key={`cg-${col.key}`} style={ORDER_COL_STYLE.slip} />
        ))}
        <col style={ORDER_COL_STYLE.total} />
      </colgroup>
      <thead className="bg-muted print:table-header-group">
        <tr>
          <th
            scope="col"
            className="border-b border-r border-border bg-muted px-1.5 py-2.5 text-center text-[11px] font-semibold uppercase text-muted-foreground sm:text-[10px]"
            style={ORDER_COL_STYLE.index}
          >
            STT
          </th>
          <th
            scope="col"
            className="border-b border-r border-border bg-muted px-2 py-2.5 text-[11px] font-semibold uppercase text-muted-foreground sm:text-[10px]"
            style={ORDER_COL_STYLE.name}
          >
            <span className="block break-words leading-snug">Tên mặt hàng</span>
          </th>
          <th
            scope="col"
            className="border-b border-r border-border bg-muted px-1 py-2.5 text-center text-[11px] font-semibold uppercase text-muted-foreground sm:text-[10px]"
            style={ORDER_COL_STYLE.unit}
          >
            ĐVT
          </th>
          {columns.map((col) => {
            const tint = SLIP_COLUMN_STYLES[col.styleIdx];
            return (
              <th
                key={col.key}
                scope="col"
                className={cn("border-b border-l border-border/60 bg-muted px-1.5 py-2 align-top", tint.cell)}
                style={ORDER_COL_STYLE.slip}
              >
                <div className={cn("mb-1 h-1 w-full rounded-sm", tint.bar)} aria-hidden />
                <div className="break-words px-0.5 text-center text-[11px] font-medium leading-snug tabular-nums text-muted-foreground sm:text-[10px]">
                  {col.refLabel}
                </div>
                <div className="mt-1 break-words px-0.5 text-center text-xs font-semibold leading-snug text-foreground sm:text-[11px]">
                  {col.recipientUnitName}
                </div>
                <div className="mt-1 break-words px-0.5 pb-0.5 text-center text-[11px] leading-snug text-muted-foreground sm:text-[10px]">
                  {col.caption != null ? <span>({col.caption})</span> : <span className="italic opacity-75">—</span>}
                </div>
              </th>
            );
          })}
          <th
            scope="col"
            className="border-b border-l-2 border-primary/40 bg-muted px-1.5 py-2.5 text-center text-[11px] font-bold uppercase text-primary sm:text-[10px]"
            style={ORDER_COL_STYLE.total}
          >
            Tổng
            <br />
            <span className="font-normal text-muted-foreground">(ngày)</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <LttpOrderingMatrixRow
            key={row.commodityId}
            row={row}
            rowIndex={i}
            columns={columns}
            qtyBySlip={qtyBySlip}
            freezeLeft={freezeLeft}
          />
        ))}
      </tbody>
    </table>
  );
});

/**
 * Tab «Đặt hàng»: bảng ma trận mặt hàng × từng phiếu xuất trong ngày, màu phân cột.
 */
export function LttpOrderingTab({ effectiveUnitId, storageUnitName }) {
  const orderCaptureRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const tableCardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [orderDate, setOrderDate] = useState(() => todayIsoDate());
  /** Chuỗi gửi API: `all` | `none` | id đối tác (số trong danh mục kho). */
  const [supplierFilterKey, setSupplierFilterKey] = useState(() => "all");
  const [pngExporting, setPngExporting] = useState(false);
  const [tablePreviewOpen, setTablePreviewOpen] = useState(false);
  const [tablePreviewImageUrl, setTablePreviewImageUrl] = useState("");
  const [tablePreviewBlob, setTablePreviewBlob] = useState(null);
  const [tablePreviewLoading, setTablePreviewLoading] = useState(false);
  const [tablePreviewSharing, setTablePreviewSharing] = useState(false);
  /** Hiện bảng đầy đủ khi chụp PNG (mobile đang dùng pager 1 cột). */
  const [forceShowTableForCapture, setForceShowTableForCapture] = useState(false);
  /** Chỉ số cột phiếu đang xem trên mobile pager. */
  const [mobileColumnIndex, setMobileColumnIndex] = useState(0);

  const {
    draft: orderingDraft,
    setDraftPayload: persistOrderingFilters,
    ready: orderingPersistReady,
  } = useDraftPersist({
    draftType: "ordering-filters",
    unitId: effectiveUnitId,
    enabled: effectiveUnitId != null,
  });
  const orderingHydrateKey = useRef(null);
  const orderingReadyRef = useRef(false);

  useLayoutEffect(() => {
    orderingReadyRef.current = false;
    if (effectiveUnitId == null || !orderingPersistReady) {
      return;
    }
    const k = String(effectiveUnitId);
    if (orderingHydrateKey.current === k) {
      orderingReadyRef.current = true;
      return;
    }
    orderingHydrateKey.current = k;
    const stored = orderingDraft;
    if (stored) {
      if (typeof stored.orderDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(stored.orderDate)) {
        setOrderDate(stored.orderDate);
      }
      if (
        typeof stored.supplierFilterKey === "string" &&
        stored.supplierFilterKey !== ""
      ) {
        setSupplierFilterKey(stored.supplierFilterKey);
      }
    }
    orderingReadyRef.current = true;
  }, [effectiveUnitId, orderingPersistReady]); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate once per unit

  useEffect(() => {
    if (!orderingReadyRef.current || !orderingPersistReady || effectiveUnitId == null) {
      return;
    }
    persistOrderingFilters({ orderDate, supplierFilterKey });
  }, [
    effectiveUnitId,
    orderDate,
    supplierFilterKey,
    orderingPersistReady,
    persistOrderingFilters,
  ]);

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

  const matrix = useMemo(() => buildOrderingMatrix(summary), [summary]);

  useEffect(() => {
    const n = matrix?.columns?.length ?? 0;
    if (n === 0) {
      setMobileColumnIndex(0);
      return;
    }
    setMobileColumnIndex((i) => Math.min(Math.max(i, 0), n - 1));
  }, [matrix?.columns?.length, orderDate, supplierFilterKey]);

  const supplierFilterLabel = useMemo(() => orderSupplierFilterLabel(summary), [summary]);

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

  const handleExportPngForZalo = useCallback(async () => {
    const el = orderCaptureRef.current;
    if (!el || pngExporting || isLoading || isFetching || !matrix?.rows?.length) return;
    setPngExporting(true);
    setForceShowTableForCapture(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 120));
      const blob = await captureElementToPngBlob(el, { qualityMode: "fast" });
      const filename = `dat-hang-lttp-${orderDate}.png`;
      const outcome = await shareOrDownloadPng(blob, filename);
      if (outcome === "shared") {
        notifySuccess("Đã mở chia sẻ — chọn ứng dụng đích.");
      } else if (outcome === "copied_image") {
        notifySuccess("Đã copy ảnh vào clipboard — mở ứng dụng chat và dán ảnh (Ctrl+V).");
      } else if (outcome === "downloaded_fallback") {
        notifyWarning(
          "Ứng dụng đích không nhận ảnh qua chia sẻ (hay gặp với Zalo) — đã tải ảnh. Mở Zalo → đính kèm ảnh trong album hoặc Tệp.",
        );
      } else if (outcome === "downloaded") {
        notifySuccess("Đã tải ảnh — mở ứng dụng và đính kèm file vừa tải.");
      }
    } catch (e) {
      const msg = typeof e?.message === "string" ? e.message : null;
      notifyError(msg || "Không tạo được ảnh. Thử đóng bớt cửa sổ và thử lại.");
    } finally {
      setForceShowTableForCapture(false);
      setPngExporting(false);
    }
  }, [pngExporting, isLoading, isFetching, matrix?.rows?.length, orderDate]);

  const handleOpenTablePreview = useCallback(async () => {
    const el = orderCaptureRef.current || tableCardRef.current;
    if (!el || tablePreviewLoading || isLoading || isFetching || !matrix?.rows?.length) return;
    setTablePreviewLoading(true);
    setForceShowTableForCapture(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 120));
      const blob = await captureElementToPngBlob(el, { qualityMode: "fast" });
      const nextUrl = URL.createObjectURL(blob);
      setTablePreviewImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setTablePreviewBlob(blob);
      setTablePreviewOpen(true);
    } catch (e) {
      const msg = typeof e?.message === "string" ? e.message : null;
      notifyError(msg || "Không tạo được ảnh xem trước bảng.");
    } finally {
      setForceShowTableForCapture(false);
      setTablePreviewLoading(false);
    }
  }, [isLoading, isFetching, matrix?.rows?.length, tablePreviewLoading]);

  const showLoader = isLoading || isFetching;
  const canExportPng =
    Boolean(matrix?.columns?.length && matrix?.rows?.length) && !showLoader && effectiveUnitId != null;
  const canCopyText = Boolean(orderSharePlainText) && !showLoader && effectiveUnitId != null;

  const handleShareTablePreview = useCallback(async () => {
    if (!tablePreviewBlob || tablePreviewSharing) return;
    setTablePreviewSharing(true);
    try {
      const filename = `dat-hang-lttp-${orderDate}.png`;
      const outcome = await shareOrDownloadPng(tablePreviewBlob, filename);
      if (outcome === "shared") {
        notifySuccess("Đã mở chia sẻ — chọn ứng dụng đích.");
      } else if (outcome === "copied_image") {
        notifySuccess("Đã copy ảnh vào clipboard — mở ứng dụng chat và dán ảnh (Ctrl+V).");
      } else if (outcome === "downloaded_fallback") {
        notifyWarning(
          "Ứng dụng đích không nhận ảnh qua chia sẻ (hay gặp với Zalo) — đã tải ảnh. Mở Zalo → đính kèm ảnh trong album hoặc Tệp.",
        );
      } else if (outcome === "downloaded") {
        notifySuccess("Đã tải ảnh — mở ứng dụng và đính kèm file vừa tải.");
      }
    } catch (e) {
      const msg = typeof e?.message === "string" ? e.message : null;
      notifyError(msg || "Không chia sẻ được ảnh bảng.");
    } finally {
      setTablePreviewSharing(false);
    }
  }, [tablePreviewBlob, tablePreviewSharing, orderDate]);

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

  useEffect(() => {
    return () => {
      if (tablePreviewImageUrl) URL.revokeObjectURL(tablePreviewImageUrl);
    };
  }, [tablePreviewImageUrl]);

  if (effectiveUnitId == null) {
    return <p className="text-xs text-destructive">Chưa có đơn vị kho — gán đơn vị cho tài khoản.</p>;
  }

  return (
    <div className="min-w-0 space-y-4 pb-2 print:pb-4" aria-busy={showLoader}>
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/50 p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end print:hidden">
        <label className="min-w-[160px] flex-1 space-y-1" htmlFor="lttp-ordering-date">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Ngày đặt</span>
          <input
            id="lttp-ordering-date"
            type="date"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value || todayIsoDate())}
          />
        </label>
        <label className="min-w-[200px] flex-[1.4] space-y-1" htmlFor="lttp-ordering-supplier">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Đối tác cung cấp</span>
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
        <div className="flex w-full shrink-0 flex-row flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="hidden h-9 shrink-0 gap-2 text-xs lg:inline-flex"
            disabled={!canExportPng || pngExporting}
            title="Chụp toàn bảng thành ảnh PNG để gửi Zalo hoặc ứng dụng khác."
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
            title="Mỗi phiếu một khối, có dòng trống ngăn cách để dán vào Zalo."
            onClick={() => void handleCopyOrderText()}
          >
            <ClipboardCopy className="size-3.5 shrink-0" />
            Copy text
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 gap-2 text-xs lg:hidden"
            disabled={!canExportPng || tablePreviewLoading}
            onClick={() => void handleOpenTablePreview()}
          >
            <ImageIcon className="size-3.5 shrink-0" />
            {tablePreviewLoading ? "Đang tạo ảnh…" : "Chụp bảng"}
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
          "space-y-6 rounded-xl border border-border/60 bg-gradient-to-b from-card/80 to-card/40 px-3 py-4 shadow-sm sm:px-4 sm:py-6",
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
            <p className="mt-1 break-words rounded-lg bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
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
          <div
            ref={tableCardRef}
            data-lttp-ordering-card
            className="-mx-3 w-[calc(100%+1.5rem)] overflow-visible sm:-mx-4 sm:w-[calc(100%+2rem)] print:mx-0 print:w-full print:break-inside-avoid"
          >
            <div className="mb-2 rounded-lg border border-border/70 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2.5 sm:px-4">
              <h2 className="text-balance text-xs font-semibold uppercase tracking-wide text-foreground">
                Bảng đặt hàng theo phiếu
              </h2>
              <p className="mt-0.5 text-balance text-[11px] leading-snug text-muted-foreground lg:hidden print:hidden">
                Điện thoại: xem từng đơn vị nhận — dùng ◀ ▶ hoặc chọn trong danh sách.
              </p>
              <p className="mt-0.5 hidden text-balance text-[11px] leading-snug text-muted-foreground lg:block print:block">
                Máy tính: cuộn trang dọc; vuốt ngang trong bảng để xem thêm phiếu.
              </p>
            </div>

            <div
              className={
                forceShowTableForCapture ? "hidden" : "lg:hidden print:hidden"
              }
            >
              <LttpOrderingMobileUnitPager
                columns={matrix.columns}
                rows={matrix.rows}
                qtyBySlip={matrix.qtyBySlip}
                activeIndex={mobileColumnIndex}
                onActiveIndexChange={setMobileColumnIndex}
              />
            </div>

            {/* Desktop: StickyResponsiveTable (header/body tách) — không dùng để chụp PNG (dễ lệch cột). */}
            <div
              className={
                forceShowTableForCapture ? "hidden" : "hidden lg:block print:hidden"
              }
            >
              <StickyResponsiveTable
                ariaLabel="Bảng đặt hàng theo phiếu"
                stickyLevel={2}
                className="border-border/80 shadow-md"
              >
                <LttpOrderingMatrixTable
                  columns={matrix.columns}
                  rows={matrix.rows}
                  qtyBySlip={matrix.qtyBySlip}
                  freezeLeft
                />
              </StickyResponsiveTable>
            </div>

            {/* Một bảng phẳng full cột — chụp PNG + in; khớp header/body tuyệt đối. */}
            <div
              data-lttp-ordering-table-scroll
              className={cn(
                forceShowTableForCapture ? "block" : "hidden print:block",
              )}
            >
              <div className="overflow-visible rounded-lg border border-border/80 shadow-md">
                <LttpOrderingMatrixTable
                  columns={matrix.columns}
                  rows={matrix.rows}
                  qtyBySlip={matrix.qtyBySlip}
                  freezeLeft={false}
                  fixedPixelWidth
                />
              </div>
            </div>
          </div>
        ) : null}

        {!showLoader && summary && matrix && matrix.columns.length === 0 && summary.slipCount > 0 ? (
          <Card className="border-warning/25 bg-amber-500/[0.06]">
            <CardContent className="!py-6 text-center text-sm text-muted-foreground">
              Có phiếu nhưng không có cột phiếu sau lọc — kiểm tra đối tác trên từng dòng và dữ liệu phiếu.
            </CardContent>
          </Card>
        ) : null}

        {!showLoader && summary && summary.slipCount === 0 ? (
          <Card className="border-dashed">
            <CardContent className="!py-10 text-center">
              <p className="text-sm text-muted-foreground">Không có phiếu xuất cho ngày đã chọn.</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Lập phiếu ở tab <span className="font-medium text-foreground">Phiếu xuất</span> (mục Nhập xuất LTTP). Đặt <span className="font-medium text-foreground">chú thích phiếu</span> trong form để hiển thị dưới tên đơn vị ở tab Đặt hàng.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
      {tablePreviewOpen ? (
        <div className="fixed inset-0 z-[120] bg-black/80 p-3 sm:p-6 lg:hidden" role="dialog" aria-modal="true">
          <div className="mx-auto flex h-full max-w-6xl flex-col">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Ảnh toàn bộ bảng đặt hàng</p>
              <span className="text-[11px] text-white/75">Vuốt để xem toàn bộ ảnh</span>
            </div>
            <div
              data-local-scroll="true"
              className="min-h-0 flex-1 overflow-auto rounded-lg bg-black/40 p-1 pb-16"
            >
              {tablePreviewImageUrl ? (
                <img src={tablePreviewImageUrl} alt="Ảnh chụp bảng đặt hàng" className="mx-auto h-auto max-w-none rounded-lg" />
              ) : (
                <p className="px-3 py-4 text-center text-sm text-white/80">Không có ảnh xem trước.</p>
              )}
            </div>
            <div className="sticky bottom-0 mt-2 flex items-center justify-end gap-2 rounded-lg bg-black/55 p-2 backdrop-blur-sm">
              <Button
                type="button"
                variant="secondary"
                className="h-8 gap-1.5 px-2 text-xs"
                disabled={!tablePreviewBlob || tablePreviewSharing}
                onClick={() => void handleShareTablePreview()}
              >
                <ImageIcon className="size-3.5" />
                {tablePreviewSharing ? "Đang chia sẻ…" : "Chia sẻ ảnh"}
              </Button>
              <Button type="button" variant="secondary" className="h-8 gap-1.5 px-2 text-xs" onClick={() => setTablePreviewOpen(false)}>
                <X className="size-3.5" />
                Đóng
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
