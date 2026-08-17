"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApplyKitchenMenuAiMutation } from "@/features/kitchen-books/api/kitchenBooksApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { MEAL_PERIOD_LABELS } from "./KitchenDishCatalogTab.jsx";

const PERIODS = ["sang", "trua", "chieu"];

function dinhLuong(line) {
  if (line?.calcMode === "per_unit_shared") {
    return line.peoplePerUnit != null ? `${line.peoplePerUnit} người/ĐVT` : "—";
  }
  if (line?.perPersonAmount == null) {
    return "—";
  }
  return `${line.perPersonAmount} ${line.perPersonUnit || "g"}/người`;
}

function countUnmapped(periods) {
  let n = 0;
  for (const p of PERIODS) {
    for (const d of periods?.[p]?.dishes || []) {
      for (const l of d.lines || []) {
        if (!l.mapped || l.commodityId == null) {
          n += 1;
        }
      }
    }
  }
  return n;
}

function dayHasDishes(menuData) {
  for (const p of PERIODS) {
    if ((menuData?.periods?.[p]?.dishes || []).length > 0) {
      return true;
    }
  }
  return false;
}

export function KitchenMenuAiSuggestDialog({
  open,
  onClose,
  unitId,
  date,
  preview,
  warnings,
  menuData,
  onApplied,
}) {
  const [applyAi, { isLoading: applying }] = useApplyKitchenMenuAiMutation();

  if (!open || !preview) {
    return null;
  }

  const unmapped = countUnmapped(preview.periods);
  const historyCount = preview.meta?.historySampleCount ?? 0;

  async function handleApply() {
    if (dayHasDishes(menuData)) {
      const ok = window.confirm(
        "Ngày này đã có món. Áp dụng AI sẽ ghi đè cả 3 buổi (Sáng/Trưa/Chiều). Tiếp tục?",
      );
      if (!ok) {
        return;
      }
    }
    try {
      const result = await applyAi({
        unitId,
        date,
        periods: preview.periods,
      }).unwrap();
      const dropped = result?.droppedLineCount ?? 0;
      notifySuccess(
        dropped > 0
          ? `Đã áp dụng AI (bỏ ${dropped} dòng chưa map LTTP).`
          : "Đã áp dụng gợi ý AI vào thực đơn.",
      );
      onApplied?.();
      onClose();
    } catch (e) {
      notifyError(e?.data?.message ?? "Áp dụng AI thất bại");
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold">AI gợi ý thực đơn</h3>
          <p className="text-xs text-muted-foreground">
            {date} · mẫu lịch sử: {historyCount}
            {unmapped > 0 ? ` · chưa map: ${unmapped} dòng` : ""}
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" data-local-scroll="true">
          {(warnings || []).length > 0 ? (
            <ul className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
          {PERIODS.map((p) => {
            const dishes = preview.periods?.[p]?.dishes || [];
            if (!dishes.length) {
              return null;
            }
            return (
              <section key={p} className="rounded-md border border-border">
                <header className="border-b border-border bg-muted/30 px-3 py-1.5 text-sm font-semibold">
                  {MEAL_PERIOD_LABELS[p]}
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="px-3 py-1.5 font-medium">Món</th>
                        <th className="px-3 py-1.5 font-medium">LTTP</th>
                        <th className="px-3 py-1.5 font-medium">Định lượng</th>
                        <th className="px-3 py-1.5 font-medium">Map</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dishes.flatMap((dish, di) =>
                        (dish.lines?.length ? dish.lines : [null]).map((line, li) => (
                          <tr key={`${p}-${di}-${li}`} className="border-t border-border/50">
                            <td className="px-3 py-1 align-top">{li === 0 ? dish.name : ""}</td>
                            <td className="px-3 py-1 align-top">
                              {line?.commodityName || "—"}
                            </td>
                            <td className="px-3 py-1 align-top tabular-nums text-muted-foreground">
                              {line ? dinhLuong(line) : "—"}
                            </td>
                            <td className="px-3 py-1 align-top">
                              {line?.mapped ? (
                                <span className="text-xs text-emerald-700 dark:text-emerald-300">OK</span>
                              ) : (
                                <span className="text-xs text-amber-700 dark:text-amber-300">Chưa</span>
                              )}
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={applying}>
            Hủy
          </Button>
          <Button type="button" onClick={handleApply} disabled={applying}>
            {applying ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Áp dụng cả ngày
          </Button>
        </div>
      </div>
    </div>
  );
}
