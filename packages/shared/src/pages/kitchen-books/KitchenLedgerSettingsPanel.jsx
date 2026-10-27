"use client";

import { Button } from "@/components/ui/Button";
import { fieldClassSm } from "@/utils/fieldClass";
import { QtyInput } from "./KitchenLedgerEntry.jsx";

const BOOKS = [
  ["soNhapXuat", "Sổ nhập xuất LTTP"],
  ["cktc", "Công khai tài chính"],
  ["soThucDon", "Sổ thực đơn"],
  ["soTheoDoi", "Sổ theo dõi"],
];

export function KitchenLedgerSettingsPanel({ settings, saving, onChange, onSave }) {
  if (!settings) return null;
  const signatures = settings.signatures || {};

  function setFlag(key, value) {
    onChange({ ...settings, [key]: value });
  }

  function setSlot(book, index, field, value) {
    const rows = signatures[book] || [];
    onChange({
      ...settings,
      signatures: {
        ...signatures,
        [book]: rows.map((slot, slotIndex) => (slotIndex === index ? { ...slot, [field]: value } : slot)),
      },
    });
  }

  return (
    <details className="rounded-lg border border-border bg-card p-3">
      <summary className="cursor-pointer text-sm font-semibold">Cấu hình đơn vị</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          Tiền đã sử dụng
          <select className={fieldClassSm} value={settings.spentBasis} onChange={(event) => setFlag("spentBasis", event.target.value)}>
            <option value="total_out">Cộng xuất (ΣS) — sổ đang làm</option>
            <option value="meal_out">Xuất ăn (ΣO)</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Ngưỡng thừa/thiếu (đồng)
          <QtyInput label="Ngưỡng" value={settings.balanceWarnThreshold} onChange={(balanceWarnThreshold) => setFlag("balanceWarnThreshold", balanceWarnThreshold)} />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={settings.holidayLunchOnly} onChange={(event) => setFlag("holidayLunchOnly", event.target.checked)} />
          Lễ tết chỉ tính bữa trưa
        </label>
        <div className="sm:col-span-2 space-y-3 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">Chữ ký từng sổ</h3>
          <p className="text-xs text-muted-foreground">Mỗi sổ một bộ chức danh và họ tên. Để trống tên thì chỗ ký in trắng.</p>
          {BOOKS.map(([book, label]) => (
            <fieldset key={book} className="grid gap-2 rounded-md border border-border/70 p-2">
              <legend className="px-1 text-xs font-medium">{label}</legend>
              {(signatures[book] || []).map((slot, index) => (
                <div key={slot.key} className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs">
                    Chức danh
                    <input
                      aria-label={`Chức danh ${label} ${index + 1}`}
                      className={fieldClassSm}
                      maxLength={80}
                      value={slot.title}
                      onChange={(event) => setSlot(book, index, "title", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    Họ tên
                    <input
                      aria-label={`Họ tên ${label} ${index + 1}`}
                      className={fieldClassSm}
                      maxLength={120}
                      value={slot.name}
                      onChange={(event) => setSlot(book, index, "name", event.target.value)}
                    />
                  </label>
                </div>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="sm:col-span-2">
          <Button type="button" className="h-8 px-3 text-xs" disabled={saving} onClick={onSave}>
            Lưu cấu hình
          </Button>
        </div>
      </div>
    </details>
  );
}
