"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { useGetLttpCommoditiesQuery } from "@/features/lttp/api/lttpApi";
import {
  useCreateKitchenCatalogMutation,
  useDeleteKitchenCatalogMutation,
  useGetKitchenCatalogQuery,
  useUpdateKitchenCatalogMutation,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { classifyCommodityCalcMode } from "./kitchenMenuQuantity.js";
import { KitchenCommodityPicker } from "./KitchenCommodityPicker.jsx";

const inputClass =
  "w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary";

const MEAL_PERIOD_LABELS = { sang: "Sáng", trua: "Trưa", chieu: "Chiều" };

function emptyLine() {
  return {
    commodityId: null,
    calcMode: "per_person",
    perPersonAmount: "",
    perPersonUnit: "g",
    peoplePerUnit: "",
  };
}

function UnitPicker({
  canPickUnits,
  sortedUnits,
  selectedUnitId,
  manualUnitId,
  setManualUnitId,
  user,
}) {
  if (!canPickUnits) {
    return (
      <p className="text-sm text-muted-foreground">
        Đơn vị: <span className="font-medium text-foreground">{user?.unit?.name ?? "—"}</span>
      </p>
    );
  }
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Đơn vị</span>
      <select
        className="min-w-[12rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={selectedUnitId ?? ""}
        onChange={(e) => setManualUnitId(Number(e.target.value))}
      >
        {sortedUnits.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function CatalogEditor({ unitId, item, commodities, onClose, onSaved }) {
  const isEdit = Boolean(item?.id);
  const [name, setName] = useState(item?.name ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [lines, setLines] = useState(
    item?.lines?.length
      ? item.lines.map((l) => ({
          commodityId: l.commodityId,
          calcMode: l.calcMode,
          perPersonAmount: l.perPersonAmount ?? "",
          perPersonUnit: l.perPersonUnit ?? "g",
          peoplePerUnit: l.peoplePerUnit ?? "",
        }))
      : [emptyLine()],
  );

  const [createCatalog, { isLoading: creating }] = useCreateKitchenCatalogMutation();
  const [updateCatalog, { isLoading: updating }] = useUpdateKitchenCatalogMutation();
  const busy = creating || updating;

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(idx) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      notifyError("Nhập tên món");
      return;
    }
    const payloadLines = [];
    for (const l of lines) {
      if (!l.commodityId) {
        notifyError("Chọn mặt hàng LTTP cho mỗi dòng");
        return;
      }
      payloadLines.push({
        commodityId: l.commodityId,
        calcMode: l.calcMode,
        perPersonAmount: l.calcMode === "per_person" ? Number(l.perPersonAmount) : null,
        perPersonUnit: l.calcMode === "per_person" ? l.perPersonUnit : null,
        peoplePerUnit: l.calcMode === "per_unit_shared" ? Number(l.peoplePerUnit) : null,
      });
    }
    try {
      if (isEdit) {
        await updateCatalog({
          id: item.id,
          unitId,
          name: trimmedName,
          note: note.trim() || null,
          lines: payloadLines,
        }).unwrap();
        notifySuccess("Đã cập nhật món");
      } else {
        await createCatalog({
          unitId,
          name: trimmedName,
          note: note.trim() || null,
          lines: payloadLines,
        }).unwrap();
        notifySuccess("Đã thêm món");
      }
      onSaved();
      onClose();
    } catch (e) {
      notifyError(e?.data?.message ?? e?.message ?? "Lưu thất bại");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-base font-semibold">{isEdit ? "Sửa món" : "Thêm món mới"}</h3>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Tên món</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Ghi chú</span>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="space-y-3">
        {lines.map((line, idx) => (
          <div key={idx} className="rounded-md border border-border/80 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Nguyên liệu #{idx + 1}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeLine(idx)}
                aria-label="Xóa dòng"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <KitchenCommodityPicker
              commodities={commodities}
              commodityId={line.commodityId}
              onPick={(c) => {
                const mode = classifyCommodityCalcMode(c.measureUnit);
                updateLine(idx, {
                  commodityId: c.id,
                  calcMode: mode,
                  perPersonUnit: mode === "per_person" ? "g" : line.perPersonUnit,
                });
              }}
            />
            {line.calcMode === "per_person" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={cn(inputClass, "w-28")}
                  placeholder="SL"
                  value={line.perPersonAmount}
                  onChange={(e) => updateLine(idx, { perPersonAmount: e.target.value })}
                />
                <select
                  className={cn(inputClass, "w-20")}
                  value={line.perPersonUnit}
                  onChange={(e) => updateLine(idx, { perPersonUnit: e.target.value })}
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                </select>
                <span className="self-center text-xs text-muted-foreground">/ người</span>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={cn(inputClass, "w-28")}
                  placeholder="Số người"
                  value={line.peoplePerUnit}
                  onChange={(e) => updateLine(idx, { peoplePerUnit: e.target.value })}
                />
                <span className="text-xs text-muted-foreground">người / 1 đơn vị</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm nguyên liệu
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={handleSave}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Lưu
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Hủy
        </Button>
      </div>
    </div>
  );
}

export function KitchenDishCatalogTab({
  selectedUnitId,
  canAccess,
  canPickUnits,
  sortedUnits,
  manualUnitId,
  setManualUnitId,
  user,
}) {
  const { confirm } = useConfirm();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const skip = !selectedUnitId || !canAccess;
  const { data: catalog, isLoading, isFetching } = useGetKitchenCatalogQuery(
    { unitId: selectedUnitId, q },
    { skip },
  );
  const { data: commodities } = useGetLttpCommoditiesQuery(selectedUnitId, { skip });
  const commodityList = commodities ?? [];

  const [deleteCatalog, { isLoading: deleting }] = useDeleteKitchenCatalogMutation();

  const items = catalog ?? [];

  async function handleDelete(item) {
    const ok = await confirm({
      title: "Xóa món?",
      description: `Xóa «${item.name}» khỏi danh mục?`,
      confirmLabel: "Xóa",
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await deleteCatalog({ id: item.id, unitId: selectedUnitId }).unwrap();
      notifySuccess("Đã xóa");
    } catch (e) {
      notifyError(e?.data?.message ?? "Xóa thất bại");
    }
  }

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
        <div className="flex flex-wrap gap-2">
          <input
            className={cn(inputClass, "w-48")}
            placeholder="Tìm món…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditing(null);
              setShowCreate(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Thêm món
          </Button>
        </div>
      </div>

      {(showCreate || editing) && (
        <CatalogEditor
          unitId={selectedUnitId}
          item={editing}
          commodities={commodityList}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSaved={() => {}}
        />
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Tên món</th>
                <th className="px-3 py-2">Nguyên liệu</th>
                <th className="w-24 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    Chưa có món trong danh mục.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {(item.lines || [])
                        .map((l) => l.commodity?.name ?? `#${l.commodityId}`)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => {
                            setShowCreate(false);
                            setEditing(item);
                          }}
                          aria-label="Sửa"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          disabled={deleting || isFetching}
                          onClick={() => handleDelete(item)}
                          aria-label="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { MEAL_PERIOD_LABELS, UnitPicker, inputClass, emptyLine };
