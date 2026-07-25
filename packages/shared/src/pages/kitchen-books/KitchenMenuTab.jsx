"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { BookMarked, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { useGetLttpCommoditiesQuery } from "@/features/lttp/api/lttpApi";
import {
  useCreateKitchenMenuSampleMutation,
  useDeleteKitchenMenuSampleMutation,
  useGetKitchenCatalogQuery,
  useGetKitchenMenuSamplesQuery,
  useUpdateKitchenMenuSampleMutation,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import { useGetMealRosterMetaQuery } from "@/features/meal-roster/api/mealRosterApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { formatMealAmountOnly, mealRateTooltip } from "@/pages/meal-roster/mealRosterUiUtils.jsx";
import { KitchenCommodityPicker } from "./KitchenCommodityPicker.jsx";
import { MEAL_PERIOD_LABELS, UnitPicker, emptyLine, inputClass } from "./KitchenDishCatalogTab.jsx";
import { classifyCommodityCalcMode } from "./kitchenMenuQuantity.js";
import { readStoredKitchenMenuAllowance, writeStoredKitchenMenuAllowance } from "./kitchenBooksSessionPersist.js";
import { KitchenMenuSampleApplyDialog } from "./KitchenMenuSampleApplyDialog.jsx";

const PERIODS = ["sang", "trua", "chieu"];

function newDish() {
  return { name: "", lines: [emptyLine()] };
}

function toDraftDish(dish) {
  return {
    name: dish?.name ?? "",
    lines: (dish?.lines?.length ? dish.lines : [emptyLine()]).map((line) => ({
      commodityId: line.commodityId ?? null,
      calcMode: line.calcMode ?? "per_person",
      perPersonAmount: line.perPersonAmount ?? "",
      perPersonUnit: line.perPersonUnit ?? "g",
      peoplePerUnit: line.peoplePerUnit ?? "",
      commodity: line.commodity,
    })),
  };
}

function CatalogPicker({ open, onClose, onPick, unitId }) {
  const [q, setQ] = useState("");
  const { data: catalog, isLoading } = useGetKitchenCatalogQuery({ unitId, q }, { skip: !open || !unitId });

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold">Chọn từ danh mục</h3>
          <p className="text-xs text-muted-foreground">Món được thêm vào bản nháp thực đơn mẫu.</p>
        </div>
        <div className="border-b border-border px-4 py-2">
          <input
            className={inputClass}
            placeholder="Tìm món…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2" data-local-scroll="true">
          {isLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải…
            </div>
          ) : (catalog ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Không có món phù hợp.</p>
          ) : (
            <ul className="space-y-1">
              {(catalog ?? []).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => onPick(item)}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {(item.lines || []).length} nguyên liệu
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border px-4 py-3 text-right">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

export function KitchenMenuTab({
  selectedUnitId,
  canAccess,
  canPickUnits,
  sortedUnits,
  manualUnitId,
  setManualUnitId,
  user,
}) {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [storedAllowance] = useState(readStoredKitchenMenuAllowance);
  const [mealPeriod, setMealPeriod] = useState(storedAllowance.mealPeriod);
  const [rateId, setRateId] = useState(storedAllowance.rateId);
  const [draftDishes, setDraftDishes] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [editingSampleId, setEditingSampleId] = useState(null);
  const [applySample, setApplySample] = useState(null);
  const previousUnitId = useRef(selectedUnitId);

  const skip = !selectedUnitId || !canAccess;
  const { data: commodities } = useGetLttpCommoditiesQuery(selectedUnitId, { skip });
  const { data: mealMeta } = useGetMealRosterMetaQuery({ unitId: selectedUnitId }, { skip });
  const { data: samples, isLoading: loadingSamples } = useGetKitchenMenuSamplesQuery(
    { unitId: selectedUnitId, mealPeriod, rateId },
    { skip: skip || !rateId },
  );
  const [createSample, { isLoading: creating }] = useCreateKitchenMenuSampleMutation();
  const [updateSample, { isLoading: updating }] = useUpdateKitchenMenuSampleMutation();
  const [deleteSample, { isLoading: deleting }] = useDeleteKitchenMenuSampleMutation();
  const commodityList = commodities ?? [];
  const rateList = mealMeta?.rates ?? [];
  const needsMealRateSelection = Boolean(mealMeta?.needsMealRateSelection);
  const saving = creating || updating;

  useEffect(() => {
    writeStoredKitchenMenuAllowance({ mealPeriod, rateId });
  }, [mealPeriod, rateId]);

  useEffect(() => {
    const unitChanged = previousUnitId.current !== selectedUnitId;
    previousUnitId.current = selectedUnitId;
    if (unitChanged) {
      setRateId(null);
      return;
    }
    if (mealMeta && (needsMealRateSelection || !mealMeta.rates.some((rate) => rate.id === rateId))) {
      setRateId(null);
    }
  }, [mealMeta, needsMealRateSelection, rateId, selectedUnitId]);

  function updateDish(dishIndex, patch) {
    setDirty(true);
    setDraftDishes((dishes) => dishes.map((dish, index) => (index === dishIndex ? { ...dish, ...patch } : dish)));
  }

  function updateLine(dishIndex, lineIndex, patch) {
    setDirty(true);
    setDraftDishes((dishes) =>
      dishes.map((dish, index) =>
        index === dishIndex
          ? {
              ...dish,
              lines: dish.lines.map((line, index) => (index === lineIndex ? { ...line, ...patch } : line)),
            }
          : dish,
      ),
    );
  }

  async function discardDirty(description) {
    if (!dirty) {
      return true;
    }
    return confirm({
      title: "Bỏ thay đổi chưa lưu?",
      description,
      confirmLabel: "Bỏ thay đổi",
      destructive: true,
    });
  }

  async function resetDraftIfConfirmed(description) {
    if (!(await discardDirty(description))) {
      return false;
    }
    setDirty(false);
    setDraftDishes([]);
    setEditingSampleId(null);
    return true;
  }

  async function changePeriod(nextPeriod) {
    if (nextPeriod !== mealPeriod && (await resetDraftIfConfirmed("Chuyển buổi sẽ bỏ bản nháp hiện tại."))) {
      setMealPeriod(nextPeriod);
    }
  }

  async function changeRate(nextRateId) {
    if (nextRateId !== rateId && (await resetDraftIfConfirmed("Đổi mức tiền ăn sẽ bỏ bản nháp hiện tại."))) {
      setRateId(nextRateId);
    }
  }

  async function changeManualUnit(nextUnitId) {
    if (await resetDraftIfConfirmed("Đổi đơn vị sẽ bỏ bản nháp hiện tại.")) {
      setManualUnitId(nextUnitId);
    }
  }

  function addDish() {
    setDirty(true);
    setDraftDishes((dishes) => [...dishes, newDish()]);
  }

  function pickCatalog(item) {
    setDirty(true);
    setDraftDishes((dishes) => [...dishes, toDraftDish(item)]);
    setPickOpen(false);
  }

  async function handleEditSample(sample) {
    if (!(await discardDirty("Sửa mẫu khác sẽ bỏ bản nháp hiện tại."))) {
      return;
    }
    setDraftDishes((sample.dishes ?? []).map(toDraftDish));
    setEditingSampleId(sample.id);
    setDirty(false);
  }

  async function handleDeleteSample(sample) {
    const confirmed = await confirm({
      title: "Xóa thực đơn mẫu?",
      description: `Mẫu gồm ${(sample.dishes ?? []).map((dish) => dish.name).join(", ") || "chưa có món"} sẽ bị xóa.`,
      confirmLabel: "Xóa mẫu",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteSample({ id: sample.id, unitId: selectedUnitId }).unwrap();
      if (editingSampleId === sample.id) {
        setEditingSampleId(null);
      }
      notifySuccess("Đã xóa mẫu thực đơn.");
    } catch (error) {
      notifyError(error?.data?.message ?? "Xóa mẫu thất bại");
    }
  }

  async function handleSave() {
    if (!selectedUnitId || !rateId) {
      notifyError("Chọn mức tiền ăn trước khi lưu mẫu");
      return;
    }
    const dishes = draftDishes.map((dish, dishIndex) => ({
      name: String(dish.name).trim(),
      sortOrder: dishIndex,
      lines: dish.lines.map((line, lineIndex) => ({
        commodityId: line.commodityId,
        calcMode: line.calcMode,
        perPersonAmount: line.calcMode === "per_person" ? Number(line.perPersonAmount) : null,
        perPersonUnit: line.calcMode === "per_person" ? line.perPersonUnit : null,
        peoplePerUnit: line.calcMode === "per_unit_shared" ? Number(line.peoplePerUnit) : null,
        sortOrder: lineIndex,
      })),
    }));
    try {
      const payload = { unitId: selectedUnitId, mealPeriod, rateId, dishes };
      if (editingSampleId) {
        await updateSample({ id: editingSampleId, ...payload }).unwrap();
      } else {
        await createSample(payload).unwrap();
      }
      await queryClient.refetchQueries({
        queryKey: qk.kitchenBooks.menuSamples(selectedUnitId, mealPeriod, rateId),
      });
      const refreshedSamples = queryClient.getQueryData(qk.kitchenBooks.menuSamples(selectedUnitId, mealPeriod, rateId)) ?? [];
      setDirty(false);
      setEditingSampleId(null);
      setDraftDishes([]);
      notifySuccess(`Đã lưu mẫu. Hiện có ${refreshedSamples.length} mẫu cho buổi và mức này.`);
    } catch (error) {
      notifyError(error?.data?.message ?? "Lưu mẫu thất bại");
    }
  }

  return (
    <div className="space-y-4 p-1">
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-end gap-3 border-b border-border bg-background/95 px-1 py-3 backdrop-blur">
        <UnitPicker
          canPickUnits={canPickUnits}
          sortedUnits={sortedUnits}
          selectedUnitId={selectedUnitId}
          manualUnitId={manualUnitId}
          setManualUnitId={changeManualUnit}
          user={user}
        />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium",
                  mealPeriod === period ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
                onClick={() => changePeriod(period)}
              >
                {MEAL_PERIOD_LABELS[period]}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Mức tiền ăn</span>
            <select
              className={inputClass}
              value={rateId ?? ""}
              disabled={needsMealRateSelection}
              onChange={(event) => changeRate(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">— Chọn mức tiền ăn —</option>
              {rateList.map((rate) => (
                <option key={rate.id} value={rate.id} title={mealRateTooltip(rate.doiTuong)}>
                  {formatMealAmountOnly(rate.mucTienAn)} đ/người
                </option>
              ))}
            </select>
          </label>
          <Button type="button" disabled={!canAccess || saving || !selectedUnitId || needsMealRateSelection} onClick={handleSave}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Lưu mẫu
          </Button>
        </div>
      </div>

      {needsMealRateSelection ? (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          Chưa chọn mức tiền ăn áp dụng cho đơn vị — mở Sổ chấm cơm để chọn mức, rồi quay lại đây.
        </p>
      ) : null}
      {dirty ? (
        <p role="status" className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Bạn có thay đổi chưa lưu.
        </p>
      ) : null}

      {draftDishes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="font-medium">Bắt đầu thực đơn mẫu</p>
          <ol className="mx-auto mt-2 max-w-md list-decimal space-y-1 text-left text-sm text-muted-foreground">
            <li>Chọn buổi và mức tiền ăn.</li>
            <li>Chọn món từ danh mục hoặc thêm món mới.</li>
            <li>Thêm nguyên liệu và định lượng cho từng người.</li>
          </ol>
          <div className="mt-4 flex justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => setPickOpen(true)}>
              <BookMarked className="mr-1 h-4 w-4" />
              Chọn từ danh mục
            </Button>
            <Button type="button" variant="outline" onClick={addDish}>
              <Plus className="mr-1 h-4 w-4" />
              Thêm món
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {draftDishes.map((dish, dishIndex) => (
            <div
              key={dishIndex}
              className={cn("rounded-lg border border-border p-4", !String(dish.name).trim() && "ring-1 ring-amber-500/50")}
            >
              <div className="mb-3 flex items-start gap-2">
                <input
                  className={cn(inputClass, "font-medium")}
                  placeholder="Tên món"
                  value={dish.name}
                  onChange={(event) => updateDish(dishIndex, { name: event.target.value })}
                />
                <button
                  type="button"
                  aria-label="Xóa món"
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setDirty(true);
                    setDraftDishes((dishes) => dishes.filter((_, index) => index !== dishIndex));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {dish.lines.map((line, lineIndex) => (
                  <div
                    key={lineIndex}
                    className={cn(
                      "grid gap-2 rounded-md bg-muted/20 p-2 sm:grid-cols-[1fr_auto_auto]",
                      !line.commodityId && "ring-1 ring-amber-500/50",
                    )}
                  >
                    <KitchenCommodityPicker
                      commodities={commodityList}
                      commodityId={line.commodityId}
                      onPick={(commodity) =>
                        updateLine(dishIndex, lineIndex, {
                          commodityId: commodity.id,
                          commodity,
                          calcMode: classifyCommodityCalcMode(commodity.measureUnit),
                        })
                      }
                    />
                    {line.calcMode === "per_person" ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          className={cn(inputClass, "w-20")}
                          value={line.perPersonAmount}
                          onChange={(event) => updateLine(dishIndex, lineIndex, { perPersonAmount: event.target.value })}
                        />
                        <select
                          className={cn(inputClass, "w-16")}
                          value={line.perPersonUnit}
                          onChange={(event) => updateLine(dishIndex, lineIndex, { perPersonUnit: event.target.value })}
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
                          min="0"
                          className={cn(inputClass, "w-20")}
                          value={line.peoplePerUnit}
                          onChange={(event) => updateLine(dishIndex, lineIndex, { peoplePerUnit: event.target.value })}
                        />
                        <span className="text-xs text-muted-foreground">người/ĐVT</span>
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label="Xóa nguyên liệu"
                      className="self-center rounded p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => updateDish(dishIndex, { lines: dish.lines.filter((_, index) => index !== lineIndex) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => updateDish(dishIndex, { lines: [...dish.lines, emptyLine()] })}
              >
                <Plus className="mr-1 h-3 w-3" />
                Nguyên liệu
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addDish}>
              <Plus className="mr-1 h-4 w-4" />
              Thêm món
            </Button>
            <Button type="button" variant="outline" onClick={() => setPickOpen(true)}>
              <BookMarked className="mr-1 h-4 w-4" />
              Chọn từ danh mục
            </Button>
          </div>
        </div>
      )}

      <section className="space-y-2 border-t border-border pt-4">
        <div>
          <h2 className="font-semibold">Mẫu đã lưu</h2>
          <p className="text-sm text-muted-foreground">Các mẫu cho buổi và mức tiền ăn đang chọn.</p>
        </div>
        {!rateId ? (
          <p className="text-sm text-muted-foreground">Chọn mức tiền ăn để xem mẫu.</p>
        ) : loadingSamples ? (
          <p className="text-sm text-muted-foreground">Đang tải mẫu…</p>
        ) : (samples ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có mẫu nào.</p>
        ) : (
          <ul className="space-y-2">
            {(samples ?? []).map((sample) => (
              <li key={sample.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{(sample.dishes ?? []).map((dish) => dish.name).join(", ") || "Chưa đặt tên món"}</p>
                  <p className="text-sm text-muted-foreground">{formatMealAmountOnly(sample.mucTienAn)} đ/người</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => handleEditSample(sample)}>
                    Sửa
                  </Button>
                  <Button type="button" size="sm" onClick={() => setApplySample(sample)}>
                    Áp dụng
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={deleting} onClick={() => handleDeleteSample(sample)}>
                    Xóa
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CatalogPicker open={pickOpen} onClose={() => setPickOpen(false)} onPick={pickCatalog} unitId={selectedUnitId} />
      <KitchenMenuSampleApplyDialog
        open={Boolean(applySample)}
        onClose={() => setApplySample(null)}
        sample={applySample}
        unitId={selectedUnitId}
      />
    </div>
  );
}
