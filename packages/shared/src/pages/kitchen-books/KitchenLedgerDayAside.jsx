"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { fieldClassSm } from "@/utils/fieldClass";
import { LineTable } from "./KitchenLedgerEntry.jsx";
import { formatLedgerNumber } from "./ledgerNumberFormat.js";

function moneyText(value) {
  return formatLedgerNumber(value) || "0";
}

export function KitchenLedgerDayAside({
  headcount,
  finance,
  mealSlots,
  extraSlots,
  income,
  disabled,
  busy,
  previousHeadcount,
  onHeadcount,
  onIncome,
  onSaveHeadcount,
  onCopyPrevious,
  scheduleText,
  onSchedule,
  selfLines,
  selfNone,
  commodities,
  onSelfChange,
  onSaveSelf,
  onSelfNone,
}) {
  return (
    <aside className="rounded-lg border border-border bg-card p-3 text-xs">
      <h3 className="mb-1 text-sm font-semibold">Công khai tài chính ngày</h3>
      <p className="mb-2 text-muted-foreground">
        Quân số, thu và mua ngoài nhập ở đây. Dòng thực phẩm trên trang sổ lấy từ phiếu xuất và tồn ngày trước.
      </p>
      <p className="mb-2 text-muted-foreground">ĐVT: đồng</p>
      {headcount?.levels?.map((level, index) => (
        <div key={level.dailyAmount} className="mb-2 border-b border-border/70 pb-2">
          <p className="font-medium">Mức {formatLedgerNumber(level.dailyAmount, { blankZero: false })}</p>
          {mealSlots.map(([meal, label]) => {
            const server = finance?.levels?.[index]?.meals?.find((row) => row.meal === meal);
            return (
              <label key={meal} className="mt-1 grid grid-cols-[4.5rem_1fr_auto] items-center gap-1">
                <span>{label}</span>
                <input
                  aria-label={`${label} mức ${level.dailyAmount}`}
                  inputMode="numeric"
                  className={fieldClassSm}
                  disabled={disabled}
                  value={level[meal]}
                  onChange={(event) => {
                    const next = headcount.levels.map((row, rowIndex) => (
                      rowIndex === index ? { ...row, [meal]: event.target.value } : row
                    ));
                    onHeadcount({ ...headcount, levels: next });
                  }}
                />
                <span className="tabular-nums text-muted-foreground">{server ? moneyText(server.amount) : ""}</span>
              </label>
            );
          })}
        </div>
      ))}
      <div className="mb-2 border-b border-border/70 pb-2">
        <p className="font-medium">Ăn thêm</p>
        {extraSlots.map(([key, label]) => {
          const server = finance?.extras?.find((row) => row.key === key);
          return (
            <label key={key} className="mt-1 grid grid-cols-[4.5rem_1fr_auto] items-center gap-1">
              <span>{label}</span>
              <input
                aria-label={label}
                inputMode="numeric"
                className={fieldClassSm}
                disabled={disabled}
                value={headcount?.extras?.[key] ?? 0}
                onChange={(event) => onHeadcount({
                  ...headcount,
                  extras: { ...headcount.extras, [key]: event.target.value },
                })}
              />
              <span className="tabular-nums text-muted-foreground">{server ? moneyText(server.amount) : ""}</span>
            </label>
          );
        })}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
        <dt>Cộng</dt><dd className="text-right tabular-nums">{finance ? moneyText(finance.subtotal) : "—"}</dd>
        <dt>Thừa hôm trước</dt><dd className="text-right tabular-nums">{finance ? moneyText(finance.prevSurplus) : "—"}</dd>
        <dt>Bù giá gạo</dt><dd className="text-right tabular-nums">{finance ? moneyText(finance.riceSubsidy) : "—"}</dd>
      </dl>
      {[
        ["anThem", "Ăn thêm"],
        ["truyLinh", "Truy lĩnh"],
        ["thuKhach", "Thu của khách"],
      ].map(([key, label]) => (
        <label key={key} className="mt-1 grid grid-cols-[1fr_6.5rem] items-center gap-1">
          <span>{label}</span>
          <input
            aria-label={label}
            inputMode="decimal"
            className={fieldClassSm}
            disabled={disabled}
            value={income[key]}
            onChange={(event) => onIncome({ ...income, [key]: event.target.value })}
          />
        </label>
      ))}
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 border-t border-border pt-2">
        <dt className="font-medium">Cộng thu</dt>
        <dd className="text-right font-medium tabular-nums">{finance ? moneyText(finance.totalIncome) : "—"}</dd>
        <dt>Tiền đã sử dụng</dt>
        <dd className="text-right tabular-nums">{finance ? moneyText(finance.spent) : "—"}</dd>
        <dt>Thiếu hôm trước</dt>
        <dd className="text-right tabular-nums">{finance ? moneyText(finance.prevShortfall) : "—"}</dd>
        <dt className="font-medium">Cộng chi</dt>
        <dd className="text-right font-medium tabular-nums">{finance ? moneyText(finance.totalSpent) : "—"}</dd>
        <dt>Thừa trong ngày</dt>
        <dd className="text-right tabular-nums">{finance ? moneyText(finance.surplus) : "—"}</dd>
        <dt>Thiếu trong ngày</dt>
        <dd className={cn("text-right tabular-nums", finance?.shortfall && finance.shortfall !== "0" && "font-semibold text-destructive")}>
          {finance ? moneyText(finance.shortfall) : "—"}
        </dd>
      </dl>
      <label className="mt-3 grid gap-1">
        <span className="font-medium">Lịch làm việc</span>
        <textarea
          aria-label="Lịch làm việc"
          className={cn(fieldClassSm, "min-h-16 w-full")}
          maxLength={2000}
          disabled={disabled}
          value={scheduleText}
          placeholder="Trực bếp, nghỉ, phân ca…"
          onChange={(event) => onSchedule(event.target.value)}
        />
      </label>
      <p className="mt-1 text-muted-foreground">Lịch lưu cùng nút Lưu quân số. Lịch không tự đổi số trên sổ.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" className="h-8 px-3 text-xs" disabled={disabled || busy} onClick={onSaveHeadcount}>
          Lưu quân số
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-8 px-3 text-xs"
          disabled={disabled || !previousHeadcount}
          onClick={onCopyPrevious}
        >
          Lấy quân số hôm trước
        </Button>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <LineTable
          title="Mua ngoài"
          hint={selfNone ? "Đã xác nhận không có nguồn đơn vị trong ngày." : "Đơn vị bảo đảm: cột mua và tự sản xuất. Không gõ dòng trên bảo đảm ở đây."}
          lines={selfLines}
          disabled={disabled}
          commodities={commodities}
          mode="self"
          onChange={onSelfChange}
          onSave={() => onSaveSelf(false)}
          saving={busy}
          extra={(
            <Button type="button" variant="secondary" className="h-8 px-2 text-xs" disabled={disabled || busy} onClick={() => onSelfNone()}>
              Không có
            </Button>
          )}
        />
      </div>
    </aside>
  );
}
