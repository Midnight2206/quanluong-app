"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { fieldClassSm } from "@/utils/fieldClass";
import { LineTable } from "./KitchenLedgerEntry.jsx";
import { formatLedgerNumber } from "./ledgerNumberFormat.js";
import { percentSum, percentsToAmounts } from "./ledgerMealSplit.js";

function moneyText(value) {
  return formatLedgerNumber(value) || "0";
}

const SPLIT = [["sang", "Sáng"], ["trua", "Trưa"], ["chieu", "Chiều"]];

function shortRate(rate) {
  const text = String(rate?.doiTuong || "").replace(/\s+/g, " ").trim();
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

function MealRatePicker({ mealRates, disabled, busy, onSave }) {
  const dirty = useRef(false);
  const [rows, setRows] = useState([]);
  const [addId, setAddId] = useState("");
  const catalog = mealRates?.catalog || [];
  const selectedIds = new Set(rows.map((row) => Number(row.id)));
  const choices = catalog.filter((rate) => !selectedIds.has(rate.id));

  useEffect(() => {
    if (dirty.current) return;
    setRows((mealRates?.selected || []).map((rate) => ({
      id: rate.id,
      doiTuong: rate.doiTuong,
      mucTienAn: rate.mucTienAn,
      sang: String(rate.percents?.sang ?? 20),
      trua: String(rate.percents?.trua ?? 40),
      chieu: String(rate.percents?.chieu ?? 40),
      savedSang: String(rate.percents?.sang ?? 20),
      savedTrua: String(rate.percents?.trua ?? 40),
      savedChieu: String(rate.percents?.chieu ?? 40),
      periodAmounts: rate.periodAmounts || null,
    })));
  }, [mealRates]);

  function update(id, key, value) {
    dirty.current = true;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }

  function addRate() {
    const rate = catalog.find((item) => String(item.id) === addId);
    if (!rate) return;
    dirty.current = true;
    const sang = String(rate.percents?.sang ?? 20);
    const trua = String(rate.percents?.trua ?? 40);
    const chieu = String(rate.percents?.chieu ?? 40);
    setRows((current) => [...current, {
      id: rate.id,
      doiTuong: rate.doiTuong,
      mucTienAn: rate.mucTienAn,
      sang,
      trua,
      chieu,
      savedSang: sang,
      savedTrua: trua,
      savedChieu: chieu,
      periodAmounts: rate.periodAmounts || null,
    }]);
    setAddId("");
  }

  const invalid = rows.some((row) => percentSum(row) !== 100);

  return (
    <div className="mb-3 border-b border-border pb-3">
      <p className="font-medium">Mức ăn của đơn vị</p>
      <p className="mt-1 text-muted-foreground">
        Chỉ chọn mức đã có trong hệ thống. Sáng + trưa + chiều = 100%. Sổ và công khai tài chính dùng danh sách này.
      </p>
      {!mealRates?.selected?.length ? (
        <p className="mt-1 text-muted-foreground">Chưa lưu mức cho đơn vị. Sổ đang dùng mức mặc định.</p>
      ) : null}
      {rows.map((row) => {
        const sum = percentSum(row);
        const untouched = row.sang === row.savedSang && row.trua === row.savedTrua && row.chieu === row.savedChieu;
        const amounts = sum !== 100
          ? null
          : (untouched && row.periodAmounts ? row.periodAmounts : percentsToAmounts(row.mucTienAn, row));
        return (
          <div key={row.id} className="mt-2 rounded-md border border-border/70 p-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium" title={row.doiTuong}>
                {formatLedgerNumber(row.mucTienAn, { blankZero: false })}
                <span className="ml-1 font-normal text-muted-foreground">{shortRate(row)}</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                className="h-7 px-2 text-xs"
                disabled={disabled}
                onClick={() => {
                  dirty.current = true;
                  setRows((current) => current.filter((item) => item.id !== row.id));
                }}
              >
                Bỏ
              </Button>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {SPLIT.map(([key, label]) => (
                <label key={key} className="grid gap-0.5">
                  <span>{label} %</span>
                  <input
                    aria-label={`${label} mức ${row.mucTienAn}`}
                    inputMode="decimal"
                    className={fieldClassSm}
                    disabled={disabled}
                    value={row[key]}
                    onChange={(event) => update(row.id, key, event.target.value)}
                  />
                  <span className="tabular-nums text-muted-foreground">
                    {amounts ? formatLedgerNumber(amounts[key], { blankZero: false }) : ""}
                  </span>
                </label>
              ))}
            </div>
            {sum !== 100 ? <p className="mt-1 text-destructive">Tổng {sum ?? "—"}%. Cần 100%.</p> : null}
          </div>
        );
      })}
      <div className="mt-2 flex gap-1">
        <select
          aria-label="Thêm mức ăn"
          className={cn(fieldClassSm, "min-w-0 flex-1")}
          disabled={disabled || !choices.length}
          value={addId}
          onChange={(event) => setAddId(event.target.value)}
        >
          <option value="">{choices.length ? "Thêm mức ăn…" : "Đã chọn hết mức"}</option>
          {choices.map((rate) => (
            <option key={rate.id} value={rate.id}>
              {formatLedgerNumber(rate.mucTienAn, { blankZero: false })} — {shortRate(rate)}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" className="h-8 px-2 text-xs" disabled={disabled || !addId} onClick={addRate}>
          Thêm
        </Button>
      </div>
      <Button
        type="button"
        className="mt-2 h-8 px-3 text-xs"
        disabled={disabled || busy || !rows.length || invalid}
        onClick={() => {
          dirty.current = false;
          onSave(rows.map((row) => {
            const percents = { sang: Number(row.sang), trua: Number(row.trua), chieu: Number(row.chieu) };
            const untouched = row.sang === row.savedSang && row.trua === row.savedTrua && row.chieu === row.savedChieu;
            return {
              mealAllowanceRateId: row.id,
              percents,
              ...(untouched && row.periodAmounts ? { periodAmounts: row.periodAmounts } : {}),
            };
          }));
        }}
      >
        Lưu mức ăn
      </Button>
    </div>
  );
}

export function KitchenLedgerDayAside({
  headcount,
  finance,
  mealRates,
  onSaveMeals,
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
      <MealRatePicker mealRates={mealRates} disabled={disabled} busy={busy} onSave={onSaveMeals} />
      <p className="mb-2 text-muted-foreground">
        Quân số, thu và mua ngoài nhập ở đây. Dòng thực phẩm trên trang sổ lấy từ phiếu xuất và tồn ngày trước.
      </p>
      <p className="mb-2 text-muted-foreground">ĐVT: đồng</p>
      {headcount?.levels?.map((level, index) => (
        <div key={`${level.code}-${level.dailyAmount}`} className="mb-2 border-b border-border/70 pb-2">
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
        <dt>Bù giá gạo</dt>
        <dd>
          <input
            aria-label="Bù giá gạo"
            inputMode="decimal"
            className={fieldClassSm}
            disabled={disabled}
            value={income.riceSubsidy ?? ""}
            onChange={(event) => onIncome({ ...income, riceSubsidy: event.target.value })}
          />
        </dd>
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
