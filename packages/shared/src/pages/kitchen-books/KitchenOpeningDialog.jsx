"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSavePaperOpeningMutation } from "@/features/kitchen-books/api/kitchenBooksApi";
import { notifyError, notifySuccess } from "@/services/notify";

function blankRow() {
  return { key: `o${Math.random().toString(36).slice(2, 8)}`, commodityId: "", name: "", quantity: "", price: "" };
}

export function KitchenOpeningDialog({
  unitId,
  commodities,
  lines,
  open,
  onClose,
}) {
  const [rows, setRows] = useState([blankRow()]);
  const [save, saveState] = useSavePaperOpeningMutation();

  useEffect(() => {
    if (!open) return;
    const seeded = (lines || []).map((line) => ({
      key: `o${line.commodityId}`,
      commodityId: line.commodityId,
      name: line.name || "",
      quantity: String(line.quantity ?? ""),
      price: String(line.price ?? ""),
    }));
    setRows(seeded.length ? [...seeded, blankRow()] : [blankRow()]);
  }, [open, lines]);

  if (!open) return null;

  function pick(key, commodity) {
    setRows((prev) => {
      const next = prev.map((row) => (
        row.key === key
          ? { ...row, commodityId: commodity.id, name: commodity.name || "" }
          : row
      ));
      if (next[next.length - 1].commodityId) next.push(blankRow());
      return next;
    });
  }

  async function onSave() {
    try {
      await save.mutateAsync({
        unitId,
        lines: rows.filter((row) => row.commodityId).map((row) => ({
          commodityId: Number(row.commodityId),
          quantity: Number(String(row.quantity).replace(",", ".")) || 0,
          price: Number(String(row.price).replace(",", ".")) || 0,
        })),
      });
      notifySuccess("Đã ghi tồn đầu kỳ");
      onClose();
    } catch (error) {
      notifyError(error?.data?.message || error?.message || "Không ghi được tồn đầu.");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Khai báo tồn đầu">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Đóng khai báo tồn đầu" onClick={onClose} />
      <div className="relative z-10 max-h-[100dvh] w-full max-w-xl overflow-y-auto bg-card p-4 shadow-float sm:max-h-[80dvh] sm:rounded-lg" data-local-scroll="true">
        <h2 className="text-base font-semibold">Khai báo tồn đầu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chỉ làm một lần khi bếp chưa có phiếu. Sau phiếu đầu tiên, tồn đầu khóa và mỗi ngày lấy tồn cuối ngày trước.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Mặt hàng</th>
              <th>Số lượng</th>
              <th>Giá</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <input
                    aria-label="Mặt hàng tồn đầu"
                    list="opening-commodities"
                    className="w-full border-b bg-transparent py-2"
                    value={row.name}
                    onChange={(event) => {
                      const text = event.target.value;
                      const hit = (commodities || []).find((item) => item.name === text || item.code === text);
                      if (hit) pick(row.key, hit);
                      else setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, name: text, commodityId: "" } : item)));
                    }}
                  />
                </td>
                <td>
                  <input aria-label="Số lượng tồn đầu" inputMode="decimal" className="w-full border-b bg-transparent py-2 text-center" value={row.quantity} onChange={(event) => setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, quantity: event.target.value } : item)))} />
                </td>
                <td>
                  <input aria-label="Giá tồn đầu" inputMode="decimal" className="w-full border-b bg-transparent py-2 text-center" value={row.price} onChange={(event) => setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, price: event.target.value } : item)))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="opening-commodities">
          {(commodities || []).map((item) => <option key={item.id} value={item.name}>{item.measureUnit}</option>)}
        </datalist>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" className="h-11 px-3" onClick={onClose}>Để sau</Button>
          <Button type="button" className="h-11 px-3" disabled={saveState.isPending} onClick={onSave}>
            {saveState.isPending ? "Đang ghi…" : "Ghi tồn đầu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
