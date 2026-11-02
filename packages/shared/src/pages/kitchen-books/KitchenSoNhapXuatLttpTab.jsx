"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useHasPermission } from "@/features/auth/model/authSlice";
import {
  useGetKitchenLedgerAssistantQuery,
  useGetKitchenLedgerQuery,
  useLockKitchenLedgerMutation,
  useSaveKitchenLedgerMutation,
  useSaveKitchenLedgerSettingsMutation,
  useUnlockKitchenLedgerMutation,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { notifyError, notifySuccess } from "@/services/notify";
import { openKitchenLedgerMonthPdf } from "./kitchenLedgerMonthPdfOpen.js";
import { cn } from "@/utils/cn";
import { fieldClassSm } from "@/utils/fieldClass";
import { KitchenLedgerAssistantBubble } from "./KitchenLedgerAssistant.jsx";
import { KitchenLedgerDayAside } from "./KitchenLedgerDayAside.jsx";
import { KitchenLedgerSettingsPanel } from "./KitchenLedgerSettingsPanel.jsx";
import { KitchenBooksAccessGate } from "./KitchenBooksAccessGate.jsx";
import { KitchenBooksUnitPicker } from "./KitchenBooksUnitPicker.jsx";
import { Note } from "./KitchenLedgerEntry.jsx";
import { KitchenLedgerGrid } from "./KitchenLedgerGrid.jsx";
import { KitchenReceiptSlipWorkspace } from "./KitchenReceiptSlipWorkspace.jsx";
import { formatLedgerInput, parseViNumber } from "./ledgerNumberFormat.js";

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

function LedgerModal({ title, open, onClose, wide, children }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={`Đóng ${title}`} onClick={onClose} />
      <div className={cn("relative z-10 max-h-[min(40rem,calc(100dvh-2rem))] w-full overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-float", wide ? "max-w-5xl" : "max-w-xl")} data-local-scroll="true">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={onClose}>Đóng</Button>
        </div>
        {children}
      </div>
    </div>
  );
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
  const openingDirty = useRef(false);
  const [headcount, setHeadcount] = useState(null);
  const [income, setIncome] = useState({ anThem: "0", truyLinh: "0", thuKhach: "0" });
  const [openingMoney, setOpeningMoney] = useState({ surplus: "0", shortfall: "0" });
  const [settingsForm, setSettingsForm] = useState(null);
  const [scheduleText, setScheduleText] = useState("");
  const [exportingMonth, setExportingMonth] = useState(false);
  const [panel, setPanel] = useState(null);

  const skip = !canAccess || selectedUnitId == null || !menuDate;
  const { data: ledger, isLoading, error } = useGetKitchenLedgerQuery(
    { unitId: selectedUnitId, date: menuDate },
    { skip },
  );
  const { data: assistant } = useGetKitchenLedgerAssistantQuery(
    { unitId: selectedUnitId, date: menuDate },
    { skip },
  );
  const [saveLedger, saveState] = useSaveKitchenLedgerMutation();
  const [lockLedger, lockState] = useLockKitchenLedgerMutation();
  const [unlockLedger, unlockState] = useUnlockKitchenLedgerMutation();
  const [saveSettings, settingsState] = useSaveKitchenLedgerSettingsMutation();
  const canSave = useHasPermission(PERMISSIONS.KITCHEN_BOOKS_SAVE);
  const canLockDay = useHasPermission(PERMISSIONS.KITCHEN_BOOKS_LOCK);
  const canUnlockDay = useHasPermission(PERMISSIONS.KITCHEN_BOOKS_UNLOCK);
  const canExport = useHasPermission(PERMISSIONS.KITCHEN_BOOKS_EXPORT);
  const canSettings = useHasPermission(PERMISSIONS.KITCHEN_BOOKS_SETTINGS);

  useEffect(() => {
    entryDirty.current = false;
    settingsDirty.current = false;
    openingDirty.current = false;
  }, [selectedUnitId, menuDate]);

  useEffect(() => {
    if (!ledger || entryDirty.current) return;
    setHeadcount(ledger.headcount);
    setIncome({
      anThem: formatLedgerInput(ledger.otherIncome?.anThem),
      truyLinh: formatLedgerInput(ledger.otherIncome?.truyLinh),
      thuKhach: formatLedgerInput(ledger.otherIncome?.thuKhach),
      riceSubsidy: formatLedgerInput(ledger.otherIncome?.riceSubsidy),
    });
    setOpeningMoney({
      surplus: formatLedgerInput(ledger.openingFinance?.surplus),
      shortfall: formatLedgerInput(ledger.openingFinance?.shortfall),
    });
    setScheduleText(ledger.schedule?.text || ledger.frame?.inputs?.schedule?.text || "");
  }, [ledger]);

  useEffect(() => {
    if (!ledger?.settings || settingsDirty.current) return;
    const settings = ledger.settings;
    setSettingsForm({
      spentBasis: settings.spentBasis,
      balanceWarnThreshold: formatLedgerInput(settings.balanceWarnThreshold),
      holidayLunchOnly: Boolean(settings.holidayLunchOnly),
      signatures: settings.signatures,
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


  async function saveHeadcount() {
    if (!headcount) return;
    await run(async () => {
      await saveLedger({
        unitId: selectedUnitId,
        date: menuDate,
        ...(Number.isInteger(ledger?.version) ? { version: ledger.version } : {}),
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
          riceSubsidy: parseViNumber(income.riceSubsidy) ?? 0,
        },
        schedule: { text: scheduleText.trim() },
        ...(openingEditable && openingDirty.current ? {
          opening: {
            surplus: parseViNumber(openingMoney.surplus) ?? 0,
            shortfall: parseViNumber(openingMoney.shortfall) ?? 0,
          },
        } : {}),
      }).unwrap();
      openingDirty.current = false;
    }, "Đã lưu quân số");
  }

  async function onLock() {
    const ok = window.confirm("Chốt ngày với quân số đã nhập là số thực tế? Sau khi chốt, ngày chỉ xem.");
    if (!ok) return;
    await run(async () => {
      await lockLedger({ unitId: selectedUnitId, date: menuDate, confirmHeadcount: true }).unwrap();
    }, "Đã chốt ngày");
  }

  function goDate(next) {
    if (!next || next === menuDate) return;
    if (entryDirty.current && !window.confirm("Có số chưa lưu. Chuyển ngày?")) return;
    setMenuDate(next);
  }

  async function onUnlock() {
    const reason = window.prompt("Lý do mở khóa ngày này?");
    if (!reason || !reason.trim()) return;
    await run(async () => {
      await unlockLedger({ unitId: selectedUnitId, date: menuDate, reason: reason.trim() }).unwrap();
    }, "Đã mở khóa");
  }

  async function onSaveSettings() {
    if (!settingsForm) return;
    const threshold = parseViNumber(settingsForm.balanceWarnThreshold);
    if (threshold == null) {
      notifyError("Ngưỡng thừa thiếu phải là số.");
      return;
    }
    try {
      await saveSettings({
        unitId: selectedUnitId,
        spentBasis: settingsForm.spentBasis,
        balanceWarnThreshold: threshold,
        holidayLunchOnly: settingsForm.holidayLunchOnly,
        signatures: settingsForm.signatures,
      }).unwrap();
      settingsDirty.current = false;
      notifySuccess("Đã lưu cấu hình đơn vị");
    } catch (err) {
      notifyError(errText(err));
    }
  }

  async function saveMeals(rates) {
    try {
      await saveSettings({
        unitId: selectedUnitId,
        mealSelection: { validFrom: menuDate, rates },
      }).unwrap();
      notifySuccess("Đã lưu mức ăn của đơn vị");
    } catch (err) {
      notifyError(errText(err));
    }
  }

  async function onExportMonth() {
    if (selectedUnitId == null || !menuDate || exportingMonth) return;
    const tab = window.open("about:blank", "_blank");
    setExportingMonth(true);
    try {
      await openKitchenLedgerMonthPdf({
        unitId: selectedUnitId,
        month: menuDate.slice(0, 7),
        targetWindow: tab,
      });
    } finally {
      setExportingMonth(false);
    }
  }

  const locked = ledger?.status === "locked";
  const pendingDraft = (assistant?.messages || []).some((message) => {
    const payload = message.payloadJson || {};
    const kind = message.kind || "";
    if (!kind.includes("draft") && kind !== "rule_note") return false;
    return !(payload.confirmed || payload.savedOk || payload.accepted || payload.confirmedSchedules);
  });
  function closePanel() {
    setPanel(null);
  }
  const disabled = locked || !ledger?.canEdit;
  const today = ymd(new Date());
  const hour = new Date().getHours();
  const openingEditable = Boolean(ledger) && (menuDate.endsWith("-01") || ledger.carriedFrom == null);
  const finance = ledger?.structure?.finance ?? ledger?.finance;
  const mealSlots = ledger?.structure?.headcount?.meals?.map((row) => [row.key, row.label]) || MEALS;
  const extraSlots = ledger?.structure?.headcount?.extras?.map((row) => [row.key, row.label]) || EXTRAS;
  const busy = saveState.isLoading || lockState.isLoading || unlockState.isLoading;
  const stock = ledger?.frame?.books?.stock;
  const negativeLines = (ledger?.lines || []).filter((line) => line.negative);

  useEffect(() => {
    function onKey(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goDate(addDays(menuDate, -1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goDate(addDays(menuDate, 1));
      } else if (event.key === "t" || event.key === "T") {
        goDate(ymd(new Date()));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuDate]);

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
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={!ledger} onClick={() => setPanel("meals")}>Cài đặt mức ăn</Button>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={!ledger} onClick={() => setPanel("headcount")}>Nhập quân số</Button>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={!ledger || selectedUnitId == null} onClick={() => setPanel("slip")}>Sửa phiếu nhập</Button>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={!ledger} onClick={() => setPanel("assistant")}>Trợ lý</Button>
            {canSettings ? (
              <Button type="button" variant="ghost" className="h-8 px-3 text-xs" disabled={!ledger} onClick={() => setPanel("settings")}>Cấu hình sổ</Button>
            ) : null}
            {ledger ? (
              locked ? (
                <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={busy || !canUnlockDay} onClick={onUnlock}>Mở khóa</Button>
              ) : (
                <Button type="button" className="h-8 px-3 text-xs" disabled={busy || !canLockDay || !ledger.canLock} onClick={onLock}>
                  {negativeLines.length ? "Còn tồn âm, chưa chốt" : "Chốt ngày"}
                </Button>
              )
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-3 text-xs"
              disabled={selectedUnitId == null || !menuDate || exportingMonth || !canExport || ledger?.canExport === false}
              onClick={onExportMonth}
            >
              {exportingMonth ? "Đang xuất…" : ledger?.canExport === false ? "Còn tồn âm, chưa xuất sổ" : "Xuất sổ tháng"}
            </Button>
          </div>
        </div>

        {selectedUnitId != null && menuDate ? (
          <KitchenLedgerAssistantBubble
            unitId={selectedUnitId}
            date={menuDate}
            open={panel === "assistant"}
            onOpenChange={(next) => setPanel(next ? "assistant" : null)}
          />
        ) : null}

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
            </div>
            {ledger.pdfStale ? (
              <Note tone="warn">PDF lỗi thời. Phiếu xuất đã đổi sau lần xuất. Xuất PDF mới.</Note>
            ) : null}
            {negativeLines.length ? (
              <Note tone="bad">
                Còn tồn âm ({negativeLines.map((line) => line.name).join(", ")}). Chưa chốt ngày và chưa xuất sổ.
                {" "}
                <a className="underline" href={`/so-sach-bep-an?tab=so-theo-doi-lttp&date=${menuDate}&ngay=${menuDate}`}>Mở sổ theo dõi để về phiếu nhập ngày bắt đầu âm</a>
              </Note>
            ) : null}
            {ledger.needsResignature ? <Note tone="warn">Ngày này cần ký lại.</Note> : null}

            {ledger.blockers?.map((row) => <Note key={row.code + row.message} tone="bad">{row.message}</Note>)}
            {ledger.slipMismatchMessage ? <Note tone="warn">{ledger.slipMismatchMessage}</Note> : null}
            {menuDate === addDays(today, 1) && hour >= 18 && !ledger.headcountSaved ? (
              <Note tone="warn">Sau 18:00, nhập quân số ngày mai.</Note>
            ) : null}
            {ledger.manualEntryCount > 0 ? (
              <Note tone="warn">
                Đơn vị còn {ledger.manualEntryCount} dòng số lượng nhập tay cũ. Chúng không còn cộng vào sổ và chưa bị xóa.
                Hàng cột đơn vị chuyển thành phiếu nhập. Xuất ăn và xuất khác chờ phiếu xuất của bếp. Hàng Trên BĐ nằm ở phiếu xuất cấp 1.
              </Note>
            ) : null}
            {(ledger.warnings || []).filter((row) => row.code !== "negative_stock").map((row) => (
              <Note key={row.code + row.message} tone={row.code === "balance_threshold" ? "warn" : "muted"}>{row.message}</Note>
            ))}
            {pendingDraft ? (
              <Note tone="warn">Có đề xuất chưa ghi vào phiếu. Mở Trợ lý để ghi hoặc bỏ. Sổ chưa đổi cho đến khi ghi phiếu.</Note>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => goDate(addDays(menuDate, -1))}>
                Ngày trước
              </Button>
              <div className="text-center">
                <input
                  aria-label="Ngày sổ"
                  type="date"
                  className={cn(fieldClassSm, "mx-auto w-40")}
                  value={menuDate}
                  onChange={(event) => goDate(event.target.value)}
                />
                <Button type="button" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={() => goDate(today)}>
                  Hôm nay
                </Button>
              </div>
              <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => goDate(addDays(menuDate, 1))}>
                Ngày sau
              </Button>
            </div>
            <div key={menuDate} className="ledger-day-slide ledger-paper">
              <KitchenLedgerGrid
                lines={stock?.rows || ledger.structure?.rows || ledger.lines}
                totals={stock?.totals ?? ledger.structure?.totals ?? ledger.totals}
                financeLines={ledger.structure?.financeLines || ledger.frame?.books?.financeLines}
                dateLine={ledger.structure?.dateLine || ledger.frame?.books?.dateLine}
                signatures={ledger.settings?.signatures}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Một sổ. Số lượng lấy từ phiếu và ghi thẳng vào phiếu.
              Sửa phiếu nhập ở nút trên trang này (cùng phiếu với
              {" "}
              <a className="underline" href={`/so-sach-bep-an?tab=phieu-nhap-kho&date=${menuDate}`}>tab phiếu nhập kho</a>
              ), sổ tính lại tồn và thừa thiếu ngay khi lưu.
              Cột Trên BĐ lấy từ
              {" "}
              <a className="underline" href="/lttp-nhap-xuat">phiếu xuất kho cấp 1</a>
              . Xuất ăn lấy từ
              {" "}
              <a className="underline" href={`/so-sach-bep-an?tab=phieu-xuat-kho&date=${menuDate}&ngay=${menuDate}`}>phiếu xuất của bếp</a>
              .
            </p>
            <LedgerModal title="Phiếu nhập của đơn vị" wide open={panel === "slip"} onClose={closePanel}>
              <p className="mb-2 text-xs text-muted-foreground">
                Lưu phiếu là ghi thật. Sổ tính lại tồn và thừa thiếu ngay sau khi lưu.
              </p>
              <KitchenReceiptSlipWorkspace
                selectedUnitId={selectedUnitId}
                canWrite={Boolean(canSave) && !disabled}
                fixedDate={menuDate}
              />
            </LedgerModal>
            <LedgerModal title="Cài đặt mức ăn" open={panel === "meals"} onClose={closePanel}>
              <KitchenLedgerDayAside
                part="meals"
                mealRates={ledger.mealRates}
                disabled={disabled || !canSave}
                busy={busy}
                onSaveMeals={saveMeals}
              />
            </LedgerModal>
            <LedgerModal title="Nhập quân số" open={panel === "headcount"} onClose={closePanel}>
              <KitchenLedgerDayAside
                part="headcount"
                headcount={headcount}
                finance={finance}
                mealSlots={mealSlots}
                extraSlots={extraSlots}
                income={income}
                disabled={disabled || !canSave}
                busy={busy}
                previousHeadcount={ledger.previousHeadcount}
                onHeadcount={markEntry(setHeadcount)}
                onIncome={markEntry(setIncome)}
                openingMoney={openingMoney}
                openingEditable={openingEditable}
                onOpening={(next) => {
                  openingDirty.current = true;
                  markEntry(setOpeningMoney)(next);
                }}
                onSaveHeadcount={saveHeadcount}
                onCopyPrevious={() => markEntry(setHeadcount)(ledger.previousHeadcount)}
                scheduleText={scheduleText}
                onSchedule={markEntry(setScheduleText)}
              />
            </LedgerModal>
            <LedgerModal title="Cấu hình sổ" open={panel === "settings"} onClose={closePanel}>
            <KitchenLedgerSettingsPanel
              settings={canSettings ? settingsForm : null}
              saving={settingsState.isLoading}
              onChange={(next) => {
                settingsDirty.current = true;
                setSettingsForm(next);
              }}
              onSave={onSaveSettings}
            />
            </LedgerModal>

            {(ledger.changes || []).length ? (
              <ul className="text-xs text-muted-foreground">
                {ledger.changes.slice(0, 8).map((row) => (
                  <li key={row.id}>{row.action} · {row.source}{row.reason ? ` · ${row.reason}` : ""}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </KitchenBooksAccessGate>
  );
}
