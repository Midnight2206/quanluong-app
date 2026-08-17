"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, ChevronLeft, ChevronRight, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { useGetLttpCommoditiesQuery } from "@/features/lttp/api/lttpApi";
import {
  useCreateKitchenCatalogMutation,
  useGetKitchenMenuMonthMarkersQuery,
  useGetKitchenMenuQuery,
  usePutKitchenMenuMutation,
  useSuggestKitchenMenuAiMutation,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { useGetMealRateCatalogQuery } from "@/features/meal-roster/api/mealRosterApi";
import { formatMealAmountOnly, mealRateTooltip } from "@/pages/meal-roster/mealRosterUiUtils.jsx";
import { formatVnd } from "@/utils/formatVnd";
import { KitchenCommodityPicker } from "./KitchenCommodityPicker.jsx";
import { KitchenMenuAiSuggestDialog } from "./KitchenMenuAiSuggestDialog.jsx";
import { KitchenPickCatalogDialog } from "./KitchenPickCatalogDialog.jsx";
import {
  MEAL_PERIOD_LABELS,
  UnitPicker,
  emptyLine,
  inputClass,
} from "./KitchenDishCatalogTab.jsx";
import { classifyCommodityCalcMode, computeLineTotalQuantity } from "./kitchenMenuQuantity.js";
import {
  readStoredKitchenMenuAllowance,
  writeStoredKitchenMenuAllowance,
} from "./kitchenBooksSessionPersist.js";

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

function dishFromApi(d) {
  return {
    id: d.id,
    name: d.name,
    sourceCatalogId: d.sourceCatalogId,
    lines: (d.lines || []).map((l) => ({
      commodityId: l.commodityId,
      calcMode: l.calcMode,
      perPersonAmount: l.perPersonAmount ?? "",
      perPersonUnit: l.perPersonUnit ?? "g",
      peoplePerUnit: l.peoplePerUnit ?? "",
      commodity: l.commodity,
    })),
  };
}

function newDish() {
  return { id: null, name: "", sourceCatalogId: null, lines: [emptyLine()] };
}

export function KitchenMenuTab({
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
  const { confirm } = useConfirm();
  const [mealPeriod, setMealPeriod] = useState("trua");
  const [draftDishes, setDraftDishes] = useState([]);
  const [note, setNote] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [aiWarnings, setAiWarnings] = useState([]);
  const [allowanceRateId, setAllowanceRateId] = useState(() => readStoredKitchenMenuAllowance().rateId);
  const [amountPerPerson, setAmountPerPerson] = useState(() => {
    const stored = readStoredKitchenMenuAllowance().amountPerPerson;
    return stored != null ? String(stored) : "";
  });

  const skip = !selectedUnitId || !menuDate || !canAccess;
  const { data: menuData, isLoading, isFetching } = useGetKitchenMenuQuery(
    { unitId: selectedUnitId, date: menuDate },
    { skip },
  );
  const { data: markers } = useGetKitchenMenuMonthMarkersQuery(
    { unitId: selectedUnitId, yearMonth },
    { skip: skip || !yearMonth },
  );
  const { data: commodities } = useGetLttpCommoditiesQuery(selectedUnitId, { skip });
  const commodityList = commodities ?? [];
  const { data: rateCatalog } = useGetMealRateCatalogQuery(undefined, {
    skip: !canAccess,
  });
  const rateList = rateCatalog?.rates ?? rateCatalog ?? [];

  const [putMenu, { isLoading: saving }] = usePutKitchenMenuMutation();
  const [createCatalog, { isLoading: savingCatalog }] = useCreateKitchenCatalogMutation();
  const [suggestAi, { isLoading: suggestingAi }] = useSuggestKitchenMenuAiMutation();

  const headcount = menuData?.periods?.[mealPeriod]?.headcount ?? menuData?.headcounts?.[mealPeriod] ?? 0;
  const daysWithMenu = useMemo(() => new Set(markers?.daysWithMenu ?? []), [markers]);
  const selectedRate = useMemo(
    () => rateList.find((r) => Number(r.id) === Number(allowanceRateId)) ?? null,
    [rateList, allowanceRateId],
  );
  const amountNum = Number(amountPerPerson);
  const dayBudget =
    Number.isFinite(amountNum) && amountNum >= 0 && headcount > 0
      ? Math.round(amountNum * headcount)
      : null;

  useEffect(() => {
    writeStoredKitchenMenuAllowance({
      rateId: allowanceRateId,
      amountPerPerson: Number.isFinite(amountNum) && amountNum >= 0 ? amountNum : null,
    });
  }, [allowanceRateId, amountNum]);

  const loadPeriodDraft = useCallback(
    (period) => {
      const p = menuData?.periods?.[period];
      if (!p) {
        setDraftDishes([]);
        setNote("");
        return;
      }
      setDraftDishes((p.dishes || []).map(dishFromApi));
      setNote(p.note ?? "");
    },
    [menuData],
  );

  useEffect(() => {
    if (!menuData || dirty) {
      return;
    }
    loadPeriodDraft(mealPeriod);
  }, [menuData, mealPeriod, loadPeriodDraft, dirty]);

  useEffect(() => {
    setDirty(false);
  }, [menuDate, selectedUnitId]);

  function changePeriod(p) {
    if (dirty) {
      const ok = window.confirm("Bạn có thay đổi chưa lưu. Chuyển buổi sẽ bỏ thay đổi?");
      if (!ok) {
        return;
      }
    }
    setDirty(false);
    setMealPeriod(p);
    loadPeriodDraft(p);
  }

  function changeMenuDate(nextDate) {
    if (nextDate === menuDate) {
      return;
    }
    if (dirty) {
      const ok = window.confirm("Bạn có thay đổi chưa lưu. Đổi ngày sẽ bỏ thay đổi?");
      if (!ok) {
        return;
      }
    }
    setDirty(false);
    setMenuDate(nextDate);
  }

  function updateDish(idx, patch) {
    setDirty(true);
    setDraftDishes((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function updateDishLine(dishIdx, lineIdx, patch) {
    setDirty(true);
    setDraftDishes((prev) =>
      prev.map((d, i) => {
        if (i !== dishIdx) {
          return d;
        }
        return {
          ...d,
          lines: d.lines.map((l, li) => (li === lineIdx ? { ...l, ...patch } : l)),
        };
      }),
    );
  }

  function addDish() {
    setDirty(true);
    setDraftDishes((prev) => [...prev, newDish()]);
  }

  function removeDish(idx) {
    setDirty(true);
    setDraftDishes((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleAiSuggest() {
    if (!selectedUnitId || !menuDate) {
      return;
    }
    if (dirty) {
      const ok = window.confirm("Bạn có thay đổi chưa lưu. Gợi ý AI sẽ không giữ draft hiện tại. Tiếp tục?");
      if (!ok) {
        return;
      }
    }
    try {
      const data = await suggestAi({ unitId: selectedUnitId, date: menuDate }).unwrap();
      setAiPreview(data);
      setAiWarnings(data?.warnings ?? []);
      setAiOpen(true);
    } catch (e) {
      notifyError(e?.data?.message ?? "AI gợi ý thất bại");
    }
  }

  async function handleSave() {
    for (const d of draftDishes) {
      if (!String(d.name).trim()) {
        notifyError("Mỗi món cần tên");
        return;
      }
    }
    const dishes = draftDishes.map((d, i) => ({
      name: d.name.trim(),
      sortOrder: i,
      sourceCatalogId: d.sourceCatalogId,
      lines: d.lines
        .filter((l) => l.commodityId)
        .map((l, li) => ({
          commodityId: l.commodityId,
          calcMode: l.calcMode,
          perPersonAmount: l.calcMode === "per_person" ? Number(l.perPersonAmount) : null,
          perPersonUnit: l.calcMode === "per_person" ? l.perPersonUnit : null,
          peoplePerUnit: l.calcMode === "per_unit_shared" ? Number(l.peoplePerUnit) : null,
          sortOrder: li,
        })),
    }));
    try {
      await putMenu({
        unitId: selectedUnitId,
        date: menuDate,
        mealPeriod,
        note: note.trim() || null,
        dishes,
      }).unwrap();
      setDirty(false);
      notifySuccess("Đã lưu thực đơn");
    } catch (e) {
      notifyError(e?.data?.message ?? "Lưu thất bại");
    }
  }

  async function saveDishToCatalog(dish) {
    const name = String(dish.name).trim();
    if (!name) {
      notifyError("Nhập tên món trước khi lưu danh mục");
      return;
    }
    const lines = dish.lines
      .filter((l) => l.commodityId)
      .map((l, i) => ({
        commodityId: l.commodityId,
        calcMode: l.calcMode,
        perPersonAmount: l.calcMode === "per_person" ? Number(l.perPersonAmount) : null,
        perPersonUnit: l.calcMode === "per_person" ? l.perPersonUnit : null,
        peoplePerUnit: l.calcMode === "per_unit_shared" ? Number(l.peoplePerUnit) : null,
        sortOrder: i,
      }));
    if (!lines.length) {
      notifyError("Cần ít nhất một nguyên liệu");
      return;
    }
    try {
      await createCatalog({ unitId: selectedUnitId, name, lines }).unwrap();
      notifySuccess("Đã lưu vào danh mục");
    } catch (e) {
      notifyError(e?.data?.message ?? "Lưu danh mục thất bại");
    }
  }

  const dayNum = Number(menuDate.slice(8, 10));

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <UnitPicker
          canPickUnits={canPickUnits}
          sortedUnits={sortedUnits}
          selectedUnitId={selectedUnitId}
          manualUnitId={manualUnitId}
          setManualUnitId={setManualUnitId}
          user={user}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => changeMenuDate(shiftDate(menuDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={menuDate}
            onChange={(e) => changeMenuDate(e.target.value)}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => changeMenuDate(shiftDate(menuDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {daysWithMenu.has(dayNum) ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Đã có thực đơn</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium",
              mealPeriod === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
            onClick={() => changePeriod(p)}
          >
            {MEAL_PERIOD_LABELS[p]}
            <span className="ml-2 tabular-nums opacity-80">
              ({menuData?.headcounts?.[p] ?? "…"})
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Số tiền tiêu chuẩn (danh mục)</span>
          <select
            className={inputClass}
            value={allowanceRateId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              setAllowanceRateId(id);
              const rate = rateList.find((r) => Number(r.id) === id);
              if (rate?.mucTienAn != null) {
                setAmountPerPerson(String(rate.mucTienAn));
              }
            }}
          >
            <option value="">— Chọn mức tiền ăn —</option>
            {rateList.map((r) => (
              <option key={r.id} value={r.id} title={mealRateTooltip(r.doiTuong)}>
                {formatMealAmountOnly(r.mucTienAn)} đ
                {r.doiTuong ? ` — ${String(r.doiTuong).slice(0, 48)}${String(r.doiTuong).length > 48 ? "…" : ""}` : ""}
              </option>
            ))}
          </select>
          {rateList.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Không tải được danh mục — vẫn nhập trực tiếp ô Đ/người.
            </span>
          ) : selectedRate ? (
            <span className="text-xs text-muted-foreground line-clamp-2">
              {mealRateTooltip(selectedRate.doiTuong)}
            </span>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Đ/người (có thể sửa)</span>
          <input
            type="number"
            min={0}
            step={1000}
            className={cn(inputClass, "w-36 tabular-nums")}
            value={amountPerPerson}
            onChange={(e) => setAmountPerPerson(e.target.value)}
          />
        </label>
        <div className="grid gap-1 text-sm self-end">
          <span className="text-muted-foreground">Trần buổi (ước)</span>
          <div className="rounded-md border border-border bg-background px-3 py-2 font-semibold tabular-nums">
            {dayBudget != null ? formatVnd(dayBudget) : "—"}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {headcount || 0} suất × mức/người
          </span>
        </div>
      </div>

      {dirty ? (
        <div
          role="status"
          className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
        >
          Bạn có thay đổi chưa lưu. Bấm «Lưu buổi» để áp dụng.
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        Quân số buổi {MEAL_PERIOD_LABELS[mealPeriod]}:{" "}
        <span className="font-semibold tabular-nums">{headcount}</span>{" "}
        <span className="text-muted-foreground">(từ Chấm cơm, chỉ đọc)</span>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Ghi chú buổi</span>
        <input
          className={inputClass}
          value={note}
          onChange={(e) => {
            setDirty(true);
            setNote(e.target.value);
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canAccess || suggestingAi || !selectedUnitId || !menuDate}
          onClick={handleAiSuggest}
        >
          {suggestingAi ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-4 w-4" />
          )}
          AI gợi ý ngày
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setPickOpen(true)}>
          <BookMarked className="mr-1 h-4 w-4" />
          Chọn từ danh mục
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={addDish}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm món
        </Button>
        <Button type="button" size="sm" disabled={saving || isFetching} onClick={handleSave}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Lưu buổi
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải thực đơn…
        </div>
      ) : (
        <div className="space-y-4">
          {draftDishes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có món cho buổi này.</p>
          ) : (
            draftDishes.map((dish, dishIdx) => (
              <div key={dish.id ?? `new-${dishIdx}`} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex flex-wrap items-start gap-2">
                  <input
                    className={cn(inputClass, "max-w-md flex-1 font-medium")}
                    placeholder="Tên món"
                    value={dish.name}
                    onChange={(e) => updateDish(dishIdx, { name: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={savingCatalog}
                    onClick={() => saveDishToCatalog(dish)}
                  >
                    Lưu vào danh mục
                  </Button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Xóa món?",
                        description: "Xóa món khỏi thực đơn (lưu để áp dụng).",
                        confirmLabel: "Xóa",
                        destructive: true,
                      });
                      if (ok) {
                        removeDish(dishIdx);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {dish.lines.map((line, lineIdx) => {
                    const commodity =
                      line.commodity ??
                      commodityList.find((c) => c.id === line.commodityId);
                    const totals = computeLineTotalQuantity({
                      calcMode: line.calcMode,
                      perPersonAmount: line.perPersonAmount,
                      perPersonUnit: line.perPersonUnit,
                      peoplePerUnit: line.peoplePerUnit,
                      headcount,
                      commodityMeasureUnit: commodity?.measureUnit,
                    });
                    return (
                      <div
                        key={lineIdx}
                        className="grid gap-2 rounded-md bg-muted/20 p-2 sm:grid-cols-[1fr_auto_auto]"
                      >
                        <KitchenCommodityPicker
                          commodities={commodityList}
                          commodityId={line.commodityId}
                          onPick={(c) => {
                            const mode = classifyCommodityCalcMode(c.measureUnit);
                            updateDishLine(dishIdx, lineIdx, {
                              commodityId: c.id,
                              commodity: c,
                              calcMode: mode,
                            });
                          }}
                        />
                        {line.calcMode === "per_person" ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className={cn(inputClass, "w-20")}
                              value={line.perPersonAmount}
                              onChange={(e) =>
                                updateDishLine(dishIdx, lineIdx, { perPersonAmount: e.target.value })
                              }
                            />
                            <select
                              className={cn(inputClass, "w-16")}
                              value={line.perPersonUnit}
                              onChange={(e) =>
                                updateDishLine(dishIdx, lineIdx, { perPersonUnit: e.target.value })
                              }
                            >
                              <option value="g">g</option>
                              <option value="ml">ml</option>
                            </select>
                            <span className="text-xs text-muted-foreground">/người</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className={cn(inputClass, "w-20")}
                              value={line.peoplePerUnit}
                              onChange={(e) =>
                                updateDishLine(dishIdx, lineIdx, { peoplePerUnit: e.target.value })
                              }
                            />
                            <span className="text-xs text-muted-foreground">người/ĐVT</span>
                          </div>
                        )}
                        <div className="self-center text-right text-sm font-semibold tabular-nums">
                          {totals.totalQuantity} {totals.totalUnit}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => {
                    setDirty(true);
                    updateDish(dishIdx, { lines: [...dish.lines, emptyLine()] });
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Thêm nguyên liệu
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      <KitchenPickCatalogDialog
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        unitId={selectedUnitId}
        menuDate={menuDate}
        mealPeriod={mealPeriod}
      />
      <KitchenMenuAiSuggestDialog
        open={aiOpen}
        onClose={() => {
          setAiOpen(false);
          setAiPreview(null);
          setAiWarnings([]);
        }}
        unitId={selectedUnitId}
        date={menuDate}
        preview={aiPreview}
        warnings={aiWarnings}
        menuData={menuData}
        onApplied={() => {
          setDirty(false);
        }}
      />
    </div>
  );
}
