"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useGetKitchenCatalogQuery, useImportKitchenCatalogToMenuMutation } from "@/features/kitchen-books/api/kitchenBooksApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { MEAL_PERIOD_LABELS } from "./KitchenDishCatalogTab.jsx";

export function KitchenPickCatalogDialog({ open, onClose, unitId, menuDate, mealPeriod }) {
  const [q, setQ] = useState("");
  const { data: catalog, isLoading } = useGetKitchenCatalogQuery(
    { unitId, q },
    { skip: !open || !unitId },
  );
  const [importCatalog, { isLoading: importing }] = useImportKitchenCatalogToMenuMutation();

  if (!open) {
    return null;
  }

  async function handlePick(item) {
    try {
      await importCatalog({
        unitId,
        date: menuDate,
        mealPeriod,
        catalogId: item.id,
      }).unwrap();
      notifySuccess(`Đã thêm «${item.name}»`);
      onClose();
    } catch (e) {
      notifyError(e?.data?.message ?? "Thêm món thất bại");
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold">Chọn từ danh mục</h3>
          <p className="text-xs text-muted-foreground">
            {menuDate} · {MEAL_PERIOD_LABELS[mealPeriod] ?? mealPeriod}
          </p>
        </div>
        <div className="border-b border-border px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-2 text-sm"
              placeholder="Tìm món…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
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
                    disabled={importing}
                    onClick={() => handlePick(item)}
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
