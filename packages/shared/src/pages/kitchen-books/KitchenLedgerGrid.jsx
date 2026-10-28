"use client";

import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { cn } from "@/utils/cn";
import { formatLedgerNumber } from "./ledgerNumberFormat.js";
import {
  LEDGER_BODY_COLUMNS,
  LEDGER_PIN_WIDTHS,
  ledgerHeaderRows,
} from "./ledgerPageLayout.js";

function hasMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0;
}

function cellText(line, column) {
  if (!line) return "";
  if (column.key === "tt") return line.tt ?? "";
  if (column.key === "name") return line.name ?? "";
  if (column.key === "uom") return line.displayDash ? "đ" : line.uom ?? "";
  if (column.key === "unitPrice") {
    return line.displayDash ? "" : formatLedgerNumber(line.unitPrice);
  }
  if (column.key === "cktc") return "";
  if (column.qty && line.displayDash && column.dashWith && hasMoney(line[column.dashWith])) return "–";
  return formatLedgerNumber(line[column.key]);
}

function totalText(totals, column) {
  if (!column.total || !totals) return "";
  return formatLedgerNumber(totals[column.key]);
}

function CktcCell({ row }) {
  if (!row) return null;
  if (row.tone === "heading" || !row.value) return row.label;
  if (row.align === "center") {
    return (
      <span className="flex items-baseline gap-2">
        <span>{row.label}</span>
        <span className="flex-1 text-center tabular-nums">{row.value}</span>
      </span>
    );
  }
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span>{row.label}</span>
      <span className="tabular-nums">{row.value}</span>
    </span>
  );
}

function alignClass(column) {
  if (column.align === "left") return "text-left";
  if (column.align === "center") return "text-center";
  return "text-right";
}

function pinStyle(column) {
  if (column.pin == null) return undefined;
  const fallback = LEDGER_PIN_WIDTHS.slice(0, column.pin).reduce((sum, width) => sum + width, 0);
  return {
    left: `var(--ledger-pin-${column.pin}, ${fallback}px)`,
    minWidth: column.width,
  };
}

export function KitchenLedgerGrid({ lines, totals, financeLines, dateLine, signatures }) {
  const columns = LEDGER_BODY_COLUMNS;
  const header = ledgerHeaderRows(dateLine);
  const items = lines || [];
  const cktc = financeLines || [];
  const count = Math.max(items.length, cktc.length);
  const pinWidth = LEDGER_PIN_WIDTHS.reduce((sum, width) => sum + width, 0);
  return (
    <div>
      <p className="mb-1 text-right text-[11px] text-muted-foreground">ĐVT: Đồng</p>
      <StickyResponsiveTable
        ariaLabel="Sổ nhập xuất LTTP"
        pinnedColumns={2}
        pinnedWidthPx={pinWidth}
        stickyLevel={2}
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-[11px]">
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>
          <thead className="bg-secondary text-[10px] text-foreground">
            {header.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((item) => (
                  <th
                    key={item.id}
                    rowSpan={item.rowSpan}
                    colSpan={item.colSpan}
                    className={cn(
                      "whitespace-pre-line border-b border-r border-border px-1 py-1 text-center font-semibold leading-tight",
                      item.id === "name" && "text-left",
                      item.id === "cktc" && "min-w-[16rem] align-middle",
                    )}
                  >
                    {item.id === "cktc" ? (
                      <span className="block">
                        <span className="block text-[11px] font-bold tracking-wide">CÔNG KHAI TÀI CHÍNH</span>
                        <span className="mt-0.5 block font-medium">{item.dateLine}</span>
                      </span>
                    ) : item.label}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {count === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Chưa có dòng hàng. Nhập quân số và nguồn hàng, rồi lưu để lập sổ.
                </td>
              </tr>
            ) : (
              Array.from({ length: count }, (_, index) => {
                const line = items[index] || null;
                const note = cktc[index] || null;
                return (
                  <tr key={line?.tt ?? `cktc-${index}`} className={line?.negative ? "bg-destructive/10" : undefined}>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        style={pinStyle(column)}
                        className={cn(
                          "border-b border-r border-border/70 px-1 py-1 align-top",
                          alignClass(column),
                          column.qty || column.money ? "tabular-nums" : "",
                          column.pin != null && "sticky z-10 bg-card print:static",
                          line?.negative && column.key === "name" && "font-semibold text-destructive",
                          column.key === "cktc" && note?.tone === "heading" && "text-center font-bold",
                          column.key === "cktc" && note?.tone === "total" && "font-bold",
                        )}
                      >
                        {column.key === "cktc" ? <CktcCell row={note} /> : cellText(line, column)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
            {items.length > 0 ? (
              <tr className="bg-muted/40 font-semibold">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={pinStyle(column)}
                    className={cn(
                      "border-t border-r border-border bg-muted px-1 py-1.5 tabular-nums",
                      column.key === "name" ? "text-center font-bold" : "text-right",
                      column.pin != null && "sticky z-10 print:static",
                    )}
                  >
                    {column.key === "name" ? "Cộng" : totalText(totals, column)}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </StickyResponsiveTable>
      <LedgerSignatureRow signatures={signatures} />
    </div>
  );
}

function LedgerSignatureRow({ signatures }) {
  const slots = signatures?.soNhapXuat || [];
  if (!slots.length) return null;
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3 print:break-inside-avoid">
      {slots.map((slot) => (
        <div key={slot.key} className="text-center text-xs">
          <p className="font-semibold">{slot.title}</p>
          <p className="mt-10 min-h-4">{slot.name}</p>
        </div>
      ))}
    </div>
  );
}
