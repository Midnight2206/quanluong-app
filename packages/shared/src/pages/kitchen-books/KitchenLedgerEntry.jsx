"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { fieldClassSm } from "@/utils/fieldClass";
import { KitchenCommodityPicker } from "./KitchenCommodityPicker.jsx";

function newKey() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function blankLine(partial = {}) {
  return {
    key: newKey(),
    commodityId: null,
    name: "",
    measureUnit: "",
    source: "I",
    qty: "",
    unitPrice: "",
    issuePolicy: "today",
    ...partial,
  };
}

export function Note({ children, tone = "muted" }) {
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "warn" && "border-amber-500/40 bg-amber-500/10 text-foreground",
        tone === "bad" && "border-destructive/40 bg-destructive/10 text-foreground",
        tone === "muted" && "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

export function QtyInput({ value, disabled, onChange, label }) {
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className={fieldClassSm}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function LineTable({ title, hint, lines, disabled, commodities, mode, onChange, onSave, saving, extra }) {
  function patch(key, partial) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...partial } : line)));
  }
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {extra}
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={disabled} onClick={() => onChange([...lines, blankLine()])}>
            Thêm dòng
          </Button>
          <Button type="button" className="h-8 px-3 text-xs" disabled={disabled || saving} onClick={onSave}>
            Lưu
          </Button>
        </div>
      </div>
      {hint ? <p className="mb-2 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="grid gap-2">
        {lines.length === 0 ? <p className="text-xs text-muted-foreground">Chưa có dòng.</p> : null}
        {lines.map((line) => (
          <div key={line.key} className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_auto]">
            <KitchenCommodityPicker
              commodities={commodities}
              commodityId={line.commodityId}
              disabled={disabled}
              onPick={(commodity) => patch(line.key, {
                commodityId: commodity.id,
                name: commodity.name || "",
                measureUnit: commodity.measureUnit || "",
              })}
            />
            {mode === "self" ? (
              <select
                aria-label="Nguồn"
                className={fieldClassSm}
                value={line.source}
                disabled={disabled}
                onChange={(event) => patch(line.key, { source: event.target.value })}
              >
                <option value="I">Đơn vị mua TT</option>
                <option value="J">Đơn vị TGSX</option>
              </select>
            ) : (
              <input
                aria-label="Tên"
                className={fieldClassSm}
                placeholder="Tên, nếu chưa có mã"
                value={line.name}
                disabled={disabled || Boolean(line.commodityId)}
                onChange={(event) => patch(line.key, { name: event.target.value })}
              />
            )}
            <QtyInput label="Số lượng" value={line.qty} disabled={disabled} onChange={(qty) => patch(line.key, { qty })} />
            {mode === "self" ? (
              <select
                aria-label="Cách xuất"
                className={fieldClassSm}
                value={line.issuePolicy}
                disabled={disabled}
                onChange={(event) => patch(line.key, { issuePolicy: event.target.value })}
              >
                <option value="today">Xuất phần nhập hôm nay</option>
                <option value="all">Xuất cả tồn</option>
                <option value="keep">Giữ lại</option>
              </select>
            ) : (
              <QtyInput
                label="Đơn giá"
                value={line.unitPrice}
                disabled={disabled || Boolean(line.commodityId)}
                onChange={(unitPrice) => patch(line.key, { unitPrice })}
              />
            )}
            <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={disabled} onClick={() => onChange(lines.filter((row) => row.key !== line.key))}>
              Xóa
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
