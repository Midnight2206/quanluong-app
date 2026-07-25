"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApplyKitchenMenuSampleMutation } from "@/features/kitchen-books/api/kitchenBooksApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { MEAL_PERIOD_LABELS } from "./KitchenDishCatalogTab.jsx";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function KitchenMenuSampleApplyDialog({ open, onClose, sample, unitId }) {
  const [date, setDate] = useState(today);
  const [applySample, { isLoading: applying }] = useApplyKitchenMenuSampleMutation();

  useEffect(() => {
    if (open) {
      setDate(today());
    }
  }, [open, sample?.id]);

  if (!open || !sample) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      let result = await applySample({
        id: sample.id,
        unitId,
        date,
        confirmOverwrite: false,
      }).unwrap();
      if (result.willOverwrite && !result.applied) {
        const confirmed = window.confirm(
          `Ngày ${date} đã có món buổi ${MEAL_PERIOD_LABELS[sample.mealPeriod] ?? sample.mealPeriod}. Ghi đè?`,
        );
        if (!confirmed) {
          return;
        }
        result = await applySample({
          id: sample.id,
          unitId,
          date,
          confirmOverwrite: true,
        }).unwrap();
      }
      if (result.applied) {
        notifySuccess("Đã áp dụng mẫu vào sổ thực đơn.");
        onClose();
      }
    } catch (error) {
      notifyError(error?.data?.message ?? "Áp dụng mẫu thất bại");
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <form
        className="flex w-full max-w-md flex-col rounded-lg border border-border bg-card shadow-xl"
        onSubmit={handleSubmit}
      >
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold">Áp dụng thực đơn mẫu</h3>
          <p className="text-xs text-muted-foreground">
            {MEAL_PERIOD_LABELS[sample.mealPeriod] ?? sample.mealPeriod}
          </p>
        </div>
        <label className="grid gap-1 p-4 text-sm">
          <span>Ngày áp dụng</span>
          <input type="date" className="rounded-md border border-border bg-background px-3 py-2" value={date} onChange={(event) => setDate(event.target.value)} required autoFocus />
        </label>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={applying}>
            Hủy
          </Button>
          <Button type="submit" disabled={applying}>
            {applying ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Áp dụng
          </Button>
        </div>
      </form>
    </div>
  );
}
