"use client";

import { Fragment } from "react";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { cn } from "@/utils/cn";
import { formatLedgerNumber } from "./ledgerNumberFormat.js";

const COLUMNS = [
  { key: "tt", label: "TT", title: "A — Số thứ tự", align: "center", width: "2.25rem" },
  { key: "name", label: "Tên LTTP", title: "B — Tên LTTP, chất đốt", align: "left", width: "9rem" },
  { key: "uom", label: "ĐVT", title: "C — Đơn vị tính", align: "center", width: "2.75rem" },
  { key: "unitPrice", label: "Đơn giá", title: "D — Đơn giá", money: true, width: "4.5rem" },
  { key: "openingQty", label: "Tồn SL", title: "E — Ngày trước chuyển qua, số lượng", qty: true, width: "4rem" },
  { key: "openingAmount", label: "Tồn tiền", title: "F — Ngày trước chuyển qua, thành tiền", money: true, width: "5.25rem" },
  { key: "inG", label: "BĐ mua", title: "G — Trên BĐ mua TT", qty: true, width: "4rem" },
  { key: "inH", label: "BĐ TG", title: "H — Trên BĐ TGSX", qty: true, width: "3.75rem" },
  { key: "inI", label: "ĐV mua", title: "I — Đơn vị BĐ mua TT", qty: true, width: "4rem" },
  { key: "inJ", label: "ĐV TG", title: "J — Đơn vị BĐ TGSX", qty: true, width: "3.75rem" },
  { key: "inAmount", label: "Tiền nhập", title: "K — Thành tiền nhập = (G+H+I+J) × D", money: true, width: "5.25rem" },
  { key: "totalInQty", label: "Cộng SL", title: "L — Cộng nhập, số lượng", qty: true, width: "4rem" },
  { key: "totalInAmount", label: "Cộng tiền", title: "M — Cộng nhập, thành tiền", money: true, width: "5.25rem" },
  { key: "mealQty", label: "Ăn SL", title: "N — Xuất ăn trong ngày, số lượng", qty: true, width: "4rem" },
  { key: "mealAmount", label: "Ăn tiền", title: "O — Xuất ăn trong ngày, thành tiền", money: true, width: "5.25rem" },
  { key: "otherQty", label: "Khác SL", title: "P — Xuất khác, số lượng", qty: true, width: "4rem" },
  { key: "otherAmount", label: "Khác tiền", title: "Q — Xuất khác, thành tiền", money: true, width: "5rem" },
  { key: "totalOutQty", label: "Xuất SL", title: "R — Cộng xuất, số lượng", qty: true, width: "4rem" },
  { key: "totalOutAmount", label: "Xuất tiền", title: "S — Cộng xuất, thành tiền", money: true, width: "5.25rem" },
  { key: "closingQty", label: "Còn SL", title: "Tồn cuối, số lượng — chỉ trên màn hình", qty: true, width: "4rem" },
  { key: "closingAmount", label: "Còn tiền", title: "Tồn cuối, thành tiền — chỉ trên màn hình", money: true, width: "5.25rem" },
];

const TOTAL_KEYS = {
  openingAmount: "openingAmount",
  inAmount: "inAmount",
  totalInAmount: "totalInAmount",
  mealAmount: "mealAmount",
  otherAmount: "otherAmount",
  totalOutAmount: "totalOutAmount",
};

function cellText(line, column) {
  if (column.key === "tt") return line.tt ?? "";
  if (column.key === "name") return line.name ?? "";
  if (column.key === "uom") return line.displayDash ? "đ" : line.uom ?? "";
  if (column.qty && line.displayDash) return "–";
  return formatLedgerNumber(line[column.key]);
}

function totalText(totals, column) {
  const field = TOTAL_KEYS[column.key];
  if (!field || !totals) return "";
  return formatLedgerNumber(totals[field]);
}

function columnsOf(columns) {
  if (!columns?.length) return COLUMNS;
  const byKey = new Map(COLUMNS.map((column) => [column.key, column]));
  return columns.map((column) => {
    const local = byKey.get(column.key);
    if (!local) return { key: column.key, label: column.label, align: "right", title: column.label };
    return { ...local, label: column.label || local.label };
  });
}

export function KitchenLedgerGrid({ lines, totals, columns }) {
  const shown = columnsOf(columns);
  const rows = lines || [];
  return (
    <StickyResponsiveTable ariaLabel="Sổ nhập xuất LTTP" stickyLevel={2}>
      <table className="w-full min-w-[78rem] border-collapse text-left text-[11px]">
        <colgroup>
          {shown.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-secondary text-[10px] text-muted-foreground">
            {shown.map((column) => (
              <th
                key={column.key}
                title={column.title}
                className={cn(
                  "border-b border-r border-border px-1 py-1.5 font-semibold",
                  column.align === "left" ? "text-left" : column.align === "center" ? "text-center" : "text-right",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={shown.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                Chưa có dòng hàng. Nhập quân số và nguồn hàng, rồi lưu để lập sổ.
              </td>
            </tr>
          ) : (
            rows.map((line, index) => (
              <Fragment key={line.tt ?? `${line.name}-${index}`}>
                {index === 40 ? (
                  <tr>
                    <td
                      colSpan={shown.length}
                      className="border-y border-border bg-muted/50 px-2 py-1 text-center text-[10px] font-medium text-muted-foreground"
                    >
                      Cộng sang trang
                    </td>
                  </tr>
                ) : null}
                <tr className={line.negative ? "bg-destructive/10" : undefined}>
                  {shown.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "border-b border-r border-border/70 px-1 py-1 tabular-nums",
                        column.align === "left" ? "text-left" : column.align === "center" ? "text-center" : "text-right",
                        line.negative && (column.key === "closingQty" || column.key === "closingAmount") && "font-semibold text-destructive",
                      )}
                    >
                      {cellText(line, column)}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))
          )}
          {rows.length > 0 ? (
            <tr className="bg-muted/40 font-semibold">
              {shown.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "border-t border-r border-border px-1 py-1.5 tabular-nums",
                    column.key === "name" ? "text-left" : "text-right",
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
  );
}
