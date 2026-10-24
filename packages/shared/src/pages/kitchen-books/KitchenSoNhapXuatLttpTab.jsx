"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useBalanceKitchenLedgerMutation,
  useGetKitchenLedgerQuery,
  useLockKitchenLedgerMutation,
  useSaveKitchenLedgerMutation,
  useSaveKitchenLedgerSettingsMutation,
  useUnlockKitchenLedgerMutation,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import { useGetLttpCommoditiesQuery } from "@/features/lttp/api/lttpApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { fieldClassSm } from "@/utils/fieldClass";
import { KitchenBooksAccessGate } from "./KitchenBooksAccessGate.jsx";
import { KitchenBooksUnitPicker } from "./KitchenBooksUnitPicker.jsx";
import { blankLine, LineTable, Note, QtyInput } from "./KitchenLedgerEntry.jsx";
import { KitchenLedgerGrid } from "./KitchenLedgerGrid.jsx";
import { formatLedgerInput, formatLedgerNumber, parseViNumber } from "./ledgerNumberFormat.js";

const MEALS = [
  ["sang", "Sáng"],
  ["trua", "Trưa"],
  ["chieu", "Chiều"],
];
const EXTRAS = [
  ["benhXa", "Bệnh xá"],
  ["benhNhan", "Bệnh nhân"],
  ["omTrai", "Ốm tại trại"],
  ["leTet", "Lễ, tết"],
];

function errText(error) {
  const data = error?.data;
  if (data && typeof data === "object" && data.message) return data.message;
  if (typeof data === "string") return data;
  if (error?.message) return error.message;
  return "Không thực hiện được.";
}

function ymd(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function addDays(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return ymd(date);
}

function linesFrom(movements, kind) {
  return (movements || [])
    .filter((row) => row.kind === kind)
    .map((row) => blankLine({
      commodityId: row.commodityId,
      name: row.itemName || "",
      measureUnit: row.measureUnit || "",
      source: row.source === "J" ? "J" : "I",
      qty: formatLedgerInput(row.qty),
      unitPrice: formatLedgerInput(row.unitPrice),
      issuePolicy: row.issuePolicy || "today",
    }));
}

function moneyText(value) {
  return formatLedgerNumber(value) || "0";
}

export function KitchenSoNhapXuatLttpTab({
  selectedUnitId,
  canPickUnits,
  sortedUnits,
  setManualUnitId,
  user,
  menuDate,
  setMenuDate,
  canAccess,
}) {
  const entryDirty = useRef(false);
  const settingsDirty = useRef(false);
  const [headcount, setHeadcount] = useState(null);
  const [income, setIncome] = useState({ anThem: "0", truyLinh: "0", thuKhach: "0" });
  const [selfLines, setSelfLines] = useState([]);
  const [selfNone, setSelfNone] = useState(false);
  const [riceLines, setRiceLines] = useState([]);
  const [otherLines, setOtherLines] = useState([]);
  const [openingLines, setOpeningLines] = useState([]);
  const [openingMoney, setOpeningMoney] = useState({ surplus: "0", shortfall: "0" });
  const [settingsForm, setSettingsForm] = useState(null);

  const skip = !canAccess || selectedUnitId == null || !menuDate;
  const { data: ledger, isLoading, error } = useGetKitchenLedgerQuery(
    { unitId: selectedUnitId, date: menuDate },
    { skip },
  );
  const { data: commodities = [] } = useGetLttpCommoditiesQuery(selectedUnitId, { skip });
  const [saveLedger, saveState] = useSaveKitchenLedgerMutation();
  const [lockLedger, lockState] = useLockKitchenLedgerMutation();
  const [unlockLedger, unlockState] = useUnlockKitchenLedgerMutation();
  const [balanceLedger, balanceState] = useBalanceKitchenLedgerMutation();
  const [saveSettings, settingsState] = useSaveKitchenLedgerSettingsMutation();

  useEffect(() => {
    entryDirty.current = false;
    settingsDirty.current = false;
  }, [selectedUnitId, menuDate]);

  useEffect(() => {
    if (!ledger || entryDirty.current) return;
    setHeadcount(ledger.headcount);
    setIncome({
      anThem: formatLedgerInput(ledger.otherIncome?.anThem),
      truyLinh: formatLedgerInput(ledger.otherIncome?.truyLinh),
      thuKhach: formatLedgerInput(ledger.otherIncome?.thuKhach),
    });
    setSelfLines(linesFrom(ledger.movements, "self_supply"));
    setSelfNone(Boolean(ledger.selfSupplyNone));
    setRiceLines(linesFrom(ledger.movements, "rice"));
    setOtherLines(linesFrom(ledger.movements, "other_out"));
    setOpeningLines(linesFrom(ledger.movements, "opening"));
    setOpeningMoney({
      surplus: formatLedgerInput(ledger.openingFinance?.surplus),
      shortfall: formatLedgerInput(ledger.openingFinance?.shortfall),
    });
  }, [ledger]);

  useEffect(() => {
    if (!ledger?.settings || settingsDirty.current) return;
    const settings = ledger.settings;
    setSettingsForm({
      spentBasis: settings.spentBasis,
      balanceWarnThreshold: formatLedgerInput(settings.balanceWarnThreshold),
      holidayLunchOnly: Boolean(settings.holidayLunchOnly),
      riceSettlementPrice: formatLedgerInput(settings.riceSettlementPrice),
      fuelPerServing: formatLedgerInput(settings.fuelPerServing),
      requireIssueSlip: Boolean(settings.requireIssueSlip),
      requirePriceTable: Boolean(settings.requirePriceTable),
      riceManualOnGuarantee: Boolean(settings.riceManualOnGuarantee),
      milkMode: settings.milk?.mode || "patient_plus_levels",
    });
  }, [ledger]);

  function markEntry(setter) {
    return (value) => {
      entryDirty.current = true;
      setter(value);
    };
  }

  async function run(action, success) {
    try {
      await action();
      entryDirty.current = false;
      notifySuccess(success);
    } catch (err) {
      notifyError(errText(err));
    }
  }

  function readQty(line, label) {
    const qty = parseViNumber(line.qty);
    if (qty == null || qty <= 0) {
      throw new Error(`${label}: nhập số lượng lớn hơn 0.`);
    }
    return qty;
  }

  async function saveHeadcount() {
    if (!headcount) return;
    await run(async () => {
      await saveLedger({
        unitId: selectedUnitId,
        date: menuDate,
        headcount: {
          levels: headcount.levels.map((level) => ({
            code: level.code,
            dailyAmount: level.dailyAmount,
            sang: Number(level.sang) || 0,
            trua: Number(level.trua) || 0,
            chieu: Number(level.chieu) || 0,
          })),
          extras: {
            benhXa: Number(headcount.extras?.benhXa) || 0,
            benhNhan: Number(headcount.extras?.benhNhan) || 0,
            omTrai: Number(headcount.extras?.omTrai) || 0,
            leTet: Number(headcount.extras?.leTet) || 0,
          },
        },
        otherIncome: {
          anThem: parseViNumber(income.anThem) ?? 0,
          truyLinh: parseViNumber(income.truyLinh) ?? 0,
          thuKhach: parseViNumber(income.thuKhach) ?? 0,
        },
      }).unwrap();
    }, "Đã lưu quân số");
  }

  async function saveSelf(none) {
    const source = none ? [] : selfLines.filter((line) => line.commodityId || line.qty);
    await run(async () => {
      const lines = source.map((line) => {
        if (!line.commodityId) throw new Error("Nguồn đơn vị: chọn mặt hàng.");
        return {
          commodityId: line.commodityId,
          source: line.source === "J" ? "J" : "I",
          qty: readQty(line, "Nguồn đơn vị"),
          issuePolicy: line.issuePolicy || "today",
        };
      });
      await saveLedger({
        unitId: selectedUnitId,
        date: menuDate,
        selfSupply: { none, lines },
      }).unwrap();
      setSelfNone(none);
    }, none ? "Đã ghi không có nguồn đơn vị" : "Đã lưu nguồn đơn vị");
  }

  async function saveRice() {
    const source = riceLines.filter((line) => line.commodityId || line.name || line.qty);
    await run(async () => {
      const lines = source.map((line) => {
        const qty = readQty(line, "Gạo");
        if (!line.commodityId && !line.name.trim()) throw new Error("Dòng gạo cần tên hoặc mã hàng.");
        const row = { qty, name: line.name.trim() || undefined, commodityId: line.commodityId || undefined };
        if (!line.commodityId) {
          const unitPrice = parseViNumber(line.unitPrice);
          if (unitPrice == null) throw new Error("Gạo chưa có mã thì cần đơn giá.");
          row.unitPrice = unitPrice;
        }
        return row;
      });
      await saveLedger({ unitId: selectedUnitId, date: menuDate, rice: { lines } }).unwrap();
    }, "Đã lưu gạo");
  }

  async function saveOther() {
    const source = otherLines.filter((line) => line.commodityId || line.name || line.qty);
    await run(async () => {
      const lines = source.map((line) => {
        if (!line.commodityId && !line.name.trim()) throw new Error("Xuất khác: nhập tên mặt hàng.");
        return {
          commodityId: line.commodityId || undefined,
          name: line.name.trim() || undefined,
          qty: readQty(line, "Xuất khác"),
        };
      });
      await saveLedger({ unitId: selectedUnitId, date: menuDate, otherOut: { lines } }).unwrap();
    }, "Đã lưu xuất khác");
  }

  async function saveOpening() {
    const source = openingLines.filter((line) => line.name || line.qty || line.commodityId);
    await run(async () => {
      const lines = source.map((line) => {
        const qty = parseViNumber(line.qty);
        const unitPrice = parseViNumber(line.unitPrice);
        if (!line.name.trim() || !line.measureUnit.trim() || qty == null || unitPrice == null) {
          throw new Error("Tồn đầu: cần tên, đơn vị tính, số lượng và đơn giá.");
        }
        return {
          commodityId: line.commodityId || undefined,
          name: line.name.trim(),
          measureUnit: line.measureUnit.trim(),
          unitPrice,
          qty,
        };
      });
      await saveLedger({
        unitId: selectedUnitId,
        date: menuDate,
        opening: {
          surplus: parseViNumber(openingMoney.surplus) ?? 0,
          shortfall: parseViNumber(openingMoney.shortfall) ?? 0,
          lines,
        },
      }).unwrap();
    }, "Đã lưu tồn đầu");
  }

  async function onLock() {
    const ok = window.confirm("Chốt ngày với quân số đã nhập là số thực tế? Sau khi chốt, ngày chỉ xem.");
    if (!ok) return;
    await run(async () => {
      await lockLedger({ unitId: selectedUnitId, date: menuDate, confirmHeadcount: true }).unwrap();
    }, "Đã chốt ngày");
  }

  async function onUnlock() {
    const ok = window.confirm("Mở khóa ngày này? Sổ đã in cần ký lại.");
    if (!ok) return;
    await run(async () => {
      await unlockLedger({ unitId: selectedUnitId, date: menuDate }).unwrap();
    }, "Đã mở khóa");
  }

  async function onBalance() {
    const suggestions = ledger?.suggestions || [];
    if (!suggestions.length) {
      notifyError("Không có mặt hàng âm để cân đối.");
      return;
    }
    const detail = suggestions
      .map((row) => `${row.name}: nhập ${formatLedgerNumber(row.suggestQty, { blankZero: false })} ${row.uom}`)
      .join("\n");
    const ok = window.confirm(
      `Ghi các dòng này vào Đơn vị BĐ mua TT? Dòng cân đối cũ của ngày được thay, không cộng dồn.\n\n${detail}`,
    );
    if (!ok) return;
    await run(async () => {
      await balanceLedger({ unitId: selectedUnitId, date: menuDate, confirm: true }).unwrap();
    }, "Đã nhập cân đối");
  }

  async function onSaveSettings() {
    if (!settingsForm) return;
    const threshold = parseViNumber(settingsForm.balanceWarnThreshold);
    const ricePrice = parseViNumber(settingsForm.riceSettlementPrice);
    const fuel = parseViNumber(settingsForm.fuelPerServing);
    if (threshold == null || ricePrice == null || fuel == null) {
      notifyError("Ngưỡng, giá gạo quyết toán và chất đốt phải là số.");
      return;
    }
    try {
      await saveSettings({
        unitId: selectedUnitId,
        spentBasis: settingsForm.spentBasis,
        balanceWarnThreshold: threshold,
        holidayLunchOnly: settingsForm.holidayLunchOnly,
        riceSettlementPrice: ricePrice,
        fuelPerServing: fuel,
        requireIssueSlip: settingsForm.requireIssueSlip,
        requirePriceTable: settingsForm.requirePriceTable,
        riceManualOnGuarantee: settingsForm.riceManualOnGuarantee,
        milk: { mode: settingsForm.milkMode },
      }).unwrap();
      settingsDirty.current = false;
      entryDirty.current = false;
      notifySuccess("Đã lưu cấu hình đơn vị");
    } catch (err) {
      notifyError(errText(err));
    }
  }

  const locked = ledger?.status === "locked";
  const disabled = locked || !ledger?.canEdit;
  const today = ymd(new Date());
  const hour = new Date().getHours();
  const showOpening = ledger && (ledger.carriedFrom == null || ledger.carriedFrom === "stock_count" || menuDate.endsWith("-01"));
  const finance = ledger?.finance;
  const busy = saveState.isLoading || lockState.isLoading || unlockState.isLoading || balanceState.isLoading;

  return (
    <KitchenBooksAccessGate permissionLabel="kitchenBooks.access" allowed={canAccess}>
      <div className="flex min-w-0 flex-col gap-3 p-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <KitchenBooksUnitPicker
            canPickUnits={canPickUnits}
            sortedUnits={sortedUnits}
            selectedUnitId={selectedUnitId}
            setManualUnitId={setManualUnitId}
            user={user}
          />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ngày</span>
            <input
              type="date"
              className={cn(fieldClassSm, "w-40")}
              value={menuDate}
              onChange={(event) => setMenuDate(event.target.value)}
            />
          </label>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Đang tải sổ…</p> : null}
        {error ? <Note tone="bad">{errText(error)}</Note> : null}

        {ledger ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("rounded-md px-2 py-1 font-medium", locked ? "bg-secondary text-foreground" : "bg-muted text-foreground")}>
                {locked ? "Đã chốt" : "Nháp"}
              </span>
              <span>{ledger.slipCount} phiếu xuất</span>
              <span>
                {ledger.priceTable ? `Bảng giá ${ledger.priceTable.effectiveDate}` : "Chưa có bảng giá"}
              </span>
              {ledger.carriedFrom && ledger.carriedFrom !== "stock_count" ? (
                <span>Tồn đầu từ {ledger.carriedFrom}</span>
              ) : null}
              {ledger.plan ? (
                <span>
                  Suất {formatLedgerNumber(ledger.plan.servings, { blankZero: false })}
                  {" · "}gạo {formatLedgerNumber(ledger.plan.riceKg, { blankZero: false })} kg
                  {" · "}chất đốt {moneyText(ledger.plan.fuelAmount)}
                </span>
              ) : null}
            </div>

            {ledger.blockers?.map((row) => <Note key={row.code + row.message} tone="bad">{row.message}</Note>)}
            {ledger.slipMismatchMessage ? <Note tone="warn">{ledger.slipMismatchMessage}</Note> : null}
            {ledger.needsResignature ? <Note tone="warn">Ngày đã mở khóa. Khi in sổ cần ký lại.</Note> : null}
            {menuDate === addDays(today, 1) && hour >= 18 && !ledger.headcountSaved ? (
              <Note tone="warn">Sau 18:00, nhập quân số ngày mai.</Note>
            ) : null}
            {menuDate === today && hour >= 8 && !ledger.selfSupplyNone && !ledger.movements?.some((row) => row.kind === "self_supply") ? (
              <Note>Sau 08:00, xác nhận nguồn Đơn vị BĐ hoặc bấm Không có.</Note>
            ) : null}
            {(ledger.warnings || []).filter((row) => row.code !== "negative_stock").map((row) => (
              <Note key={row.code + row.message} tone={row.code === "balance_threshold" ? "warn" : "muted"}>{row.message}</Note>
            ))}
            {(ledger.warnings || []).some((row) => row.code === "negative_stock") ? (
              <Note tone="bad">Có mặt hàng tồn âm. Cân đối chỉ chạy khi bấm nút và xác nhận.</Note>
            ) : null}

            <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0">
                {ledger.ledgerBlocked ? (
                  <Note>Sổ chưa lập vì thiếu phiếu xuất hoặc bảng giá. Quân số và dòng nhập vẫn lưu được.</Note>
                ) : (
                  <KitchenLedgerGrid lines={ledger.lines} totals={ledger.totals} />
                )}
              </div>
              <aside className="rounded-lg border border-border bg-card p-3 text-xs">
                <h3 className="mb-2 text-sm font-semibold">Công khai tài chính</h3>
                <p className="mb-2 text-muted-foreground">ĐVT: đồng</p>
                {headcount?.levels?.map((level, index) => (
                  <div key={level.dailyAmount} className="mb-2 border-b border-border/70 pb-2">
                    <p className="font-medium">Mức {formatLedgerNumber(level.dailyAmount, { blankZero: false })}</p>
                    {MEALS.map(([meal, label]) => {
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
                              markEntry(setHeadcount)({ ...headcount, levels: next });
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
                  {EXTRAS.map(([key, label]) => {
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
                          onChange={(event) => markEntry(setHeadcount)({
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
                      onChange={(event) => markEntry(setIncome)({ ...income, [key]: event.target.value })}
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" className="h-8 px-3 text-xs" disabled={disabled || busy} onClick={saveHeadcount}>
                    Lưu quân số
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    disabled={disabled || !ledger.previousHeadcount}
                    onClick={() => markEntry(setHeadcount)(ledger.previousHeadcount)}
                  >
                    Lấy quân số hôm trước
                  </Button>
                </div>
              </aside>
            </div>

            <div className="flex flex-wrap gap-2">
              {locked ? (
                <Button type="button" variant="secondary" disabled={busy} onClick={onUnlock}>Mở khóa</Button>
              ) : (
                <Button type="button" disabled={busy || !ledger.canLock} onClick={onLock}>Chốt ngày</Button>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={disabled || busy || ledger.ledgerBlocked || !(ledger.suggestions || []).length}
                onClick={onBalance}
              >
                Cân đối tồn âm
              </Button>
            </div>

            <LineTable
              title="Đơn vị bảo đảm"
              hint={selfNone ? "Đã xác nhận không có nguồn đơn vị trong ngày." : "Cột I mua TT và cột J TGSX. Trên BĐ lấy từ phiếu xuất, không sửa ở đây."}
              lines={selfLines}
              disabled={disabled}
              commodities={commodities}
              mode="self"
              onChange={markEntry(setSelfLines)}
              onSave={() => saveSelf(false)}
              saving={busy}
              extra={(
                <Button type="button" variant="secondary" className="h-8 px-2 text-xs" disabled={disabled || busy} onClick={() => saveSelf(true)}>
                  Không có
                </Button>
              )}
            />
            <LineTable
              title="Gạo — Trên BĐ mua TT"
              hint="Gạo nhập tay. Các mặt hàng khác trên phiếu xuất không sửa được."
              lines={riceLines}
              disabled={disabled}
              commodities={commodities}
              mode="rice"
              onChange={markEntry(setRiceLines)}
              onSave={saveRice}
              saving={busy}
            />
            <LineTable
              title="Xuất khác"
              hint="Cột P. Không gồm xuất ăn."
              lines={otherLines}
              disabled={disabled}
              commodities={commodities}
              mode="other"
              onChange={markEntry(setOtherLines)}
              onSave={saveOther}
              saving={busy}
            />

            {showOpening ? (
              <section className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Tồn đầu và thừa thiếu đầu kỳ</h3>
                  <Button type="button" className="h-8 px-3 text-xs" disabled={disabled || busy} onClick={saveOpening}>Lưu tồn đầu</Button>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Ngày 01 hoặc khi chưa có ngày trước. Dòng tồn đầu thay tồn chuyển sang.
                </p>
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs">
                    Thừa đầu kỳ
                    <QtyInput label="Thừa đầu kỳ" value={openingMoney.surplus} disabled={disabled} onChange={(surplus) => markEntry(setOpeningMoney)({ ...openingMoney, surplus })} />
                  </label>
                  <label className="grid gap-1 text-xs">
                    Thiếu đầu kỳ
                    <QtyInput label="Thiếu đầu kỳ" value={openingMoney.shortfall} disabled={disabled} onChange={(shortfall) => markEntry(setOpeningMoney)({ ...openingMoney, shortfall })} />
                  </label>
                </div>
                <div className="mb-2 flex justify-end">
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={disabled} onClick={() => markEntry(setOpeningLines)([...openingLines, blankLine()])}>
                    Thêm dòng
                  </Button>
                </div>
                <div className="grid gap-2">
                  {openingLines.map((line) => (
                    <div key={line.key} className="grid gap-2 sm:grid-cols-5">
                      <input aria-label="Tên tồn" className={fieldClassSm} placeholder="Tên" value={line.name} disabled={disabled} onChange={(event) => markEntry(setOpeningLines)(openingLines.map((row) => row.key === line.key ? { ...row, name: event.target.value } : row))} />
                      <input aria-label="ĐVT tồn" className={fieldClassSm} placeholder="ĐVT" value={line.measureUnit} disabled={disabled} onChange={(event) => markEntry(setOpeningLines)(openingLines.map((row) => row.key === line.key ? { ...row, measureUnit: event.target.value } : row))} />
                      <QtyInput label="Số lượng tồn" value={line.qty} disabled={disabled} onChange={(qty) => markEntry(setOpeningLines)(openingLines.map((row) => row.key === line.key ? { ...row, qty } : row))} />
                      <QtyInput label="Đơn giá tồn" value={line.unitPrice} disabled={disabled} onChange={(unitPrice) => markEntry(setOpeningLines)(openingLines.map((row) => row.key === line.key ? { ...row, unitPrice } : row))} />
                      <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={disabled} onClick={() => markEntry(setOpeningLines)(openingLines.filter((row) => row.key !== line.key))}>Xóa</Button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <details className="rounded-lg border border-border bg-card p-3">
              <summary className="cursor-pointer text-sm font-semibold">Cấu hình đơn vị</summary>
              {settingsForm ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs">
                    Tiền đã sử dụng
                    <select
                      className={fieldClassSm}
                      value={settingsForm.spentBasis}
                      onChange={(event) => {
                        settingsDirty.current = true;
                        setSettingsForm({ ...settingsForm, spentBasis: event.target.value });
                      }}
                    >
                      <option value="total_out">Cộng xuất (ΣS) — sổ đang làm</option>
                      <option value="meal_out">Xuất ăn (ΣO)</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs">
                    Ngưỡng thừa/thiếu (đồng)
                    <QtyInput
                      label="Ngưỡng"
                      value={settingsForm.balanceWarnThreshold}
                      onChange={(balanceWarnThreshold) => {
                        settingsDirty.current = true;
                        setSettingsForm({ ...settingsForm, balanceWarnThreshold });
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    Giá gạo quyết toán
                    <QtyInput
                      label="Giá gạo quyết toán"
                      value={settingsForm.riceSettlementPrice}
                      onChange={(riceSettlementPrice) => {
                        settingsDirty.current = true;
                        setSettingsForm({ ...settingsForm, riceSettlementPrice });
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    Chất đốt mỗi suất
                    <QtyInput
                      label="Chất đốt mỗi suất"
                      value={settingsForm.fuelPerServing}
                      onChange={(fuelPerServing) => {
                        settingsDirty.current = true;
                        setSettingsForm({ ...settingsForm, fuelPerServing });
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    Sữa
                    <select
                      className={fieldClassSm}
                      value={settingsForm.milkMode}
                      onChange={(event) => {
                        settingsDirty.current = true;
                        setSettingsForm({ ...settingsForm, milkMode: event.target.value });
                      }}
                    >
                      <option value="patient_plus_levels">Bệnh nhân + mức trong cấu hình</option>
                      <option value="purchase">Mua theo ngày (Đại đội 5)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settingsForm.holidayLunchOnly}
                      onChange={(event) => {
                        settingsDirty.current = true;
                        setSettingsForm({ ...settingsForm, holidayLunchOnly: event.target.checked });
                      }}
                    />
                    Lễ tết chỉ tính bữa trưa
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settingsForm.requireIssueSlip}
                      onChange={(event) => {
                        settingsDirty.current = true;
                        setSettingsForm({ ...settingsForm, requireIssueSlip: event.target.checked });
                      }}
                    />
                    Bắt buộc có phiếu xuất
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settingsForm.requirePriceTable}
                      onChange={(event) => {
                        settingsDirty.current = true;
                        setSettingsForm({ ...settingsForm, requirePriceTable: event.target.checked });
                      }}
                    />
                    Bắt buộc có bảng giá
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settingsForm.riceManualOnGuarantee}
                      onChange={(event) => {
                        settingsDirty.current = true;
                        setSettingsForm({ ...settingsForm, riceManualOnGuarantee: event.target.checked });
                      }}
                    />
                    Gạo trên phiếu không ghi vào Trên BĐ
                  </label>
                  <div className="sm:col-span-2">
                    <Button type="button" className="h-8 px-3 text-xs" disabled={settingsState.isLoading} onClick={onSaveSettings}>
                      Lưu cấu hình
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Mặc định theo bếp tiểu đoàn. Mức ăn, định lượng gia vị và bước làm tròn nằm trong cấu hình đơn vị, không gắn cứng một bếp.
                    </p>
                  </div>
                </div>
              ) : null}
            </details>
          </>
        ) : null}
      </div>
    </KitchenBooksAccessGate>
  );
}
