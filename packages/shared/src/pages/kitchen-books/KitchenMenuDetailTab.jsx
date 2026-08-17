"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useGetKitchenMenuDetailQuery,
  useGetKitchenMenuMonthMarkersQuery,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import { formatVnd } from "@/utils/formatVnd";
import { MEAL_PERIOD_LABELS, UnitPicker } from "./KitchenDishCatalogTab.jsx";

const PERIODS = ["sang", "trua", "chieu"];

function shiftDate(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatQty(v) {
  if (v == null || v === "") {
    return "—";
  }
  const n = Number(v);
  if (!Number.isFinite(n)) {
    return String(v);
  }
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(n);
}

function dinhLuongLabel(line) {
  if (line.calcMode === "per_unit_shared") {
    const ppu = line.peoplePerUnit;
    return ppu != null && ppu !== "" ? `${formatQty(ppu)} người/ĐVT` : "—";
  }
  const amount = line.perPersonAmount;
  const unit = line.perPersonUnit || "g";
  if (amount == null || amount === "") {
    return "—";
  }
  return `${formatQty(amount)} ${unit}/người`;
}

function periodHasDishes(period) {
  return (period?.dishes || []).some((d) => (d.lines || []).length > 0 || d.name);
}

export function KitchenMenuDetailTab({
  selectedUnitId,
  menuDate,
  setMenuDate,
  yearMonth,
  canAccess,
  canPickUnits,
  sortedUnits,
  manualUnitId,
  setManualUnitId,
  user,
}) {
  const skip = !selectedUnitId || !menuDate || !canAccess;
  const { data, isLoading, isFetching } = useGetKitchenMenuDetailQuery(
    { unitId: selectedUnitId, date: menuDate },
    { skip },
  );
  const { data: markers } = useGetKitchenMenuMonthMarkersQuery(
    { unitId: selectedUnitId, yearMonth },
    { skip: skip || !yearMonth },
  );
  const daysWithMenu = useMemo(() => new Set(markers?.daysWithMenu ?? []), [markers]);
  const dayNum = Number(menuDate.slice(8, 10));

  const hasAnyDish = useMemo(
    () => PERIODS.some((p) => periodHasDishes(data?.periods?.[p])),
    [data],
  );

  return (
    <div className="space-y-4 p-1">
      <div
        data-sticky-level="2"
        className="unified-sticky-surface flex flex-wrap items-end justify-between gap-3 border-b border-border/60 bg-background/95 py-2 backdrop-blur-sm"
      >
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sổ thực đơn — xem tổng hợp (chỉ đọc)
          </p>
          <UnitPicker
            canPickUnits={canPickUnits}
            sortedUnits={sortedUnits}
            selectedUnitId={selectedUnitId}
            manualUnitId={manualUnitId}
            setManualUnitId={setManualUnitId}
            user={user}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => setMenuDate(shiftDate(menuDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={menuDate}
            onChange={(e) => setMenuDate(e.target.value)}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => setMenuDate(shiftDate(menuDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {daysWithMenu.has(dayNum) ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Đã có thực đơn</span>
          ) : null}
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Tổng ngày</span>
          <span className="font-semibold tabular-nums">{formatVnd(data?.dayAmount ?? 0)}</span>
          {data?.missingPriceCount > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-100">
              Thiếu giá: {data.missingPriceCount} dòng
            </span>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải thực đơn chi tiết…
        </div>
      ) : !hasAnyDish ? (
        <p className="text-sm text-muted-foreground">
          Chưa có món cho ngày này. Nhập ở tab «Thực đơn chi tiết».
        </p>
      ) : (
        <>
          {PERIODS.map((p) => {
            const period = data?.periods?.[p];
            if (!periodHasDishes(period)) {
              return null;
            }
            const rows = [];
            for (const dish of period.dishes || []) {
              const lines = dish.lines?.length ? dish.lines : [null];
              lines.forEach((line, i) => {
                rows.push({
                  key: `${dish.id ?? dish.name}-${i}`,
                  dishName: i === 0 ? dish.name : "",
                  line,
                });
              });
            }
            return (
              <section key={p} className="rounded-lg border border-border">
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 text-sm">
                  <div>
                    <span className="font-semibold">{MEAL_PERIOD_LABELS[p]}</span>
                    <span className="ml-2 text-muted-foreground tabular-nums">
                      {period.headcount ?? 0} suất
                    </span>
                  </div>
                  <div className="font-semibold tabular-nums">{formatVnd(period.mealAmount ?? 0)}</div>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Món</th>
                        <th className="px-3 py-2 font-medium">Thực phẩm</th>
                        <th className="px-3 py-2 font-medium">Định lượng</th>
                        <th className="px-3 py-2 text-right font-medium">Đơn giá</th>
                        <th className="px-3 py-2 text-right font-medium">Thành tiền</th>
                        <th className="px-3 py-2 text-right font-medium">Tổng cần</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.key} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-1.5 align-top font-medium">{r.dishName || ""}</td>
                          <td className="px-3 py-1.5 align-top">{r.line?.commodity?.name ?? "—"}</td>
                          <td className="px-3 py-1.5 align-top tabular-nums text-muted-foreground">
                            {r.line ? dinhLuongLabel(r.line) : "—"}
                          </td>
                          <td className="px-3 py-1.5 align-top text-right tabular-nums">
                            {formatVnd(r.line?.unitPrice)}
                          </td>
                          <td className="px-3 py-1.5 align-top text-right tabular-nums">
                            {formatVnd(r.line?.lineAmount)}
                          </td>
                          <td className="px-3 py-1.5 align-top text-right tabular-nums">
                            {r.line
                              ? `${formatQty(r.line.totalQuantity)} ${r.line.totalUnit || ""}`.trim()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          <section className="rounded-lg border border-border">
            <header className="border-b border-border bg-muted/30 px-3 py-2 text-sm font-semibold">
              Tổng hợp LTTP ngày
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Thực phẩm</th>
                    <th className="px-3 py-2 font-medium">ĐVT</th>
                    <th className="px-3 py-2 text-right font-medium">Tổng SL</th>
                    <th className="px-3 py-2 text-right font-medium">Đơn giá</th>
                    <th className="px-3 py-2 text-right font-medium">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.commodityTotals || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-muted-foreground">
                        Không có LTTP
                      </td>
                    </tr>
                  ) : (
                    data.commodityTotals.map((row) => (
                      <tr key={row.commodityId} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-1.5">{row.name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.measureUnit || "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatQty(row.totalQuantity)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatVnd(row.unitPrice)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatVnd(row.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
