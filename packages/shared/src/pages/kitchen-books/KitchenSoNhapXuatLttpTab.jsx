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
import { useGetLttpCommoditiesQuery } from "@/features/lttp/api/lttpApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { openKitchenLedgerMonthPdf } from "./kitchenLedgerMonthPdfOpen.js";
import { cn } from "@/utils/cn";
import { fieldClassSm } from "@/utils/fieldClass";
import { KitchenLedgerAssistantBubble } from "./KitchenLedgerAssistant.jsx";
import { KitchenLedgerDayAside } from "./KitchenLedgerDayAside.jsx";
import { KitchenLedgerSettingsPanel } from "./KitchenLedgerSettingsPanel.jsx";
import { KitchenBooksAccessGate } from "./KitchenBooksAccessGate.jsx";
import { KitchenBooksUnitPicker } from "./KitchenBooksUnitPicker.jsx";
import { blankLine, LineTable, Note, QtyInput } from "./KitchenLedgerEntry.jsx";
import { KitchenLedgerGrid } from "./KitchenLedgerGrid.jsx";
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

function LedgerModal({ title, open, onClose, children }) {
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
      <div className="relative z-10 max-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-float" data-local-scroll="true">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={onClose}>Đóng</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function linesFrom(movements, kind) {
  return (movements || [])
    .filter((row) => row.kind === kind)
    .map((row) => blankLine({
      commodityId: row.commodityId,
      name: row.itemName || "",
      measureUnit: row.measureUnit || "",
      source: ["G", "H", "I", "J"].includes(row.source) ? row.source : "I",
      qty: formatLedgerInput(row.qty),
      unitPrice: formatLedgerInput(row.unitPrice),
      sourceKind: row.sourceKind || "",
      grade: row.grade || "",
      issuePolicy: row.issuePolicy || "today",
    }));
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
  const [mealLines, setMealLines] = useState([]);
  const [otherLines, setOtherLines] = useState([]);
  const [openingLines, setOpeningLines] = useState([]);
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
  const { data: commodities = [] } = useGetLttpCommoditiesQuery(selectedUnitId, { skip });
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
    setSelfLines(linesFrom(ledger.movements, "self_supply"));
    setSelfNone(Boolean(ledger.selfSupplyNone));
    setRiceLines(linesFrom(ledger.movements, "rice"));
    setMealLines(linesFrom(ledger.movements, "meal_out"));
    setOtherLines(linesFrom(ledger.movements, "other_out"));
    setOpeningLines(linesFrom(ledger.movements, "opening"));
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

  function identityOf(line, label) {
    const commodity = commodities.find((row) => row.id === line.commodityId);
    const sourceKind = line.sourceKind || commodity?.sourceKind || "";
    const grade = String(line.grade || commodity?.grade || "").trim();
    if (sourceKind !== "market" && sourceKind !== "tgsx") {
      throw new Error(`${label}: chọn nguồn Mua TT hoặc TGSX.`);
    }
    if (!grade) throw new Error(`${label}: chọn phẩm cấp.`);
    return { sourceKind, grade };
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
          ...identityOf(line, "Nguồn đơn vị"),
        };
      });
      await saveLedger({
        unitId: selectedUnitId,
        date: menuDate,
        ...(Number.isInteger(ledger?.version) ? { version: ledger.version } : {}),
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
        const row = {
          qty,
          source: ["G", "H", "I", "J"].includes(line.source) ? line.source : "G",
          name: line.name.trim() || undefined,
          commodityId: line.commodityId || undefined,
          ...identityOf(line, "Gạo"),
        };
        if (!line.commodityId) {
          const unitPrice = parseViNumber(line.unitPrice);
          if (unitPrice == null) throw new Error("Gạo chưa có mã thì cần đơn giá.");
          row.unitPrice = unitPrice;
        }
        return row;
      });
      await saveLedger({
        unitId: selectedUnitId,
        date: menuDate,
        ...(Number.isInteger(ledger?.version) ? { version: ledger.version } : {}),
        rice: { lines },
      }).unwrap();
    }, "Đã lưu gạo");
  }

  async function saveMeal() {
    const source = mealLines.filter((line) => line.commodityId || line.name || line.qty);
    await run(async () => {
      const lines = source.map((line) => {
        if (!line.commodityId && !line.name.trim()) throw new Error("Xuất ăn: nhập tên mặt hàng.");
        return {
          commodityId: line.commodityId || undefined,
          name: line.name.trim() || undefined,
          qty: readQty(line, "Xuất ăn"),
          ...identityOf(line, "Xuất ăn"),
        };
      });
      await saveLedger({
        unitId: selectedUnitId,
        date: menuDate,
        ...(Number.isInteger(ledger?.version) ? { version: ledger.version } : {}),
        mealOut: { lines },
      }).unwrap();
    }, "Đã lưu xuất ăn");
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
          ...identityOf(line, "Xuất khác"),
        };
      });
      await saveLedger({
        unitId: selectedUnitId,
        date: menuDate,
        ...(Number.isInteger(ledger?.version) ? { version: ledger.version } : {}),
        otherOut: { lines },
      }).unwrap();
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
        ...(Number.isInteger(ledger?.version) ? { version: ledger.version } : {}),
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
  const showOpening = ledger && (ledger.carriedFrom == null || ledger.carriedFrom === "stock_count" || menuDate.endsWith("-01"));
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
          <div className="flex flex-wrap items-end gap-2">
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
              </Note>
            ) : null}
            {ledger.needsResignature ? <Note tone="warn">Ngày này cần ký lại.</Note> : null}

            {ledger.blockers?.map((row) => <Note key={row.code + row.message} tone="bad">{row.message}</Note>)}
            {ledger.slipMismatchMessage ? <Note tone="warn">{ledger.slipMismatchMessage}</Note> : null}
            {menuDate === addDays(today, 1) && hour >= 18 && !ledger.headcountSaved ? (
              <Note tone="warn">Sau 18:00, nhập quân số ngày mai.</Note>
            ) : null}
            {menuDate === today && hour >= 8 && !ledger.selfSupplyNone && !ledger.movements?.some((row) => row.kind === "self_supply") ? (
              <Note>Sau 08:00, xác nhận nguồn Đơn vị BĐ hoặc bấm Không có.</Note>
            ) : null}
            {(ledger.warnings || []).filter((row) => row.code !== "negative_stock").map((row) => (
              <Note key={row.code + row.message} tone={row.code === "balance_threshold" ? "warn" : "muted"}>{row.message}</Note>
            ))}
            {pendingDraft ? (
              <Note tone="warn">Có bản nháp chưa chấp nhận. Mở Trợ lý để xem, chấp nhận hoặc bỏ. Sổ chưa đổi.</Note>
            ) : null}
            <div className="grid items-start gap-3">
              <section className="min-w-0 rounded-md border border-border bg-card p-3 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => goDate(addDays(menuDate, -1))}>
                    Ngày trước
                  </Button>
                  <div className="text-center">
                    <h2 className="text-sm font-semibold">Sổ nhập xuất LTTP</h2>
                    <p className="text-xs text-muted-foreground">Công khai tài chính ngày</p>
                    <input
                      aria-label="Ngày sổ"
                      type="date"
                      className={cn(fieldClassSm, "mx-auto mt-1 w-40")}
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
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setPanel("meals")}>Cài đặt mức ăn</Button>
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setPanel("headcount")}>Nhập quân số</Button>
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setPanel("quantities")}>Nhập số lượng</Button>
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setPanel("assistant")}>Trợ lý</Button>
                  {canSettings ? (
                    <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setPanel("settings")}>Cấu hình sổ</Button>
                  ) : null}
                </div>
                <div key={menuDate} className="ledger-day-slide">
                  <KitchenLedgerGrid
                    lines={stock?.rows || ledger.structure?.rows || ledger.lines}
                    totals={stock?.totals ?? ledger.structure?.totals ?? ledger.totals}
                    financeLines={ledger.structure?.financeLines || ledger.frame?.books?.financeLines}
                    dateLine={ledger.structure?.dateLine || ledger.frame?.books?.dateLine}
                    signatures={ledger.settings?.signatures}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Nhập trên bảo đảm lấy từ phiếu xuất của đơn vị trong ngày.
                  {" "}
                  <a className="underline" href="/lttp-nhap-xuat">Mở phiếu xuất kho</a>
                  . Sửa phiếu thì cột Trên BĐ và tồn chuyển sang cập nhật ngay, kể cả ngày đã chốt.
                </p>
              </section>
            </div>
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
                onSaveHeadcount={saveHeadcount}
                onCopyPrevious={() => markEntry(setHeadcount)(ledger.previousHeadcount)}
                scheduleText={scheduleText}
                onSchedule={markEntry(setScheduleText)}
              />
            </LedgerModal>
            <LedgerModal title="Nhập số lượng" open={panel === "quantities"} onClose={closePanel}>
              <KitchenLedgerDayAside
                part="supply"
                disabled={disabled || !canSave}
                busy={busy}
                selfLines={selfLines}
                selfNone={selfNone}
                commodities={commodities}
                onSelfChange={markEntry(setSelfLines)}
                onSaveSelf={saveSelf}
                onSelfNone={() => saveSelf(true)}
              />
            <LineTable
              title="Gạo nhập tay – tạm thời"
              hint="Gạo được ghi vào G, H, I hoặc J. Hàng khác ở cột Trên BĐ chỉ lấy từ phiếu xuất."
              lines={riceLines}
              disabled={disabled || !canSave}
              commodities={commodities}
              mode="rice"
              onChange={markEntry(setRiceLines)}
              onSave={saveRice}
              saving={busy}
            />
            <LineTable
              title="Xuất ăn"
              hint="Số lượng xuất ăn trong ngày. Đổi quân số không đổi số này."
              lines={mealLines}
              disabled={disabled || !canSave}
              commodities={commodities}
              mode="meal"
              onChange={markEntry(setMealLines)}
              onSave={saveMeal}
              saving={busy}
            />
            <LineTable
              title="Xuất khác"
              hint="Cột P. Không gồm xuất ăn."
              lines={otherLines}
              disabled={disabled || !canSave}
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

            <div className="flex flex-wrap gap-2">
              {locked ? (
                <Button type="button" variant="secondary" disabled={busy || !canUnlockDay} onClick={onUnlock}>Mở khóa</Button>
              ) : (
                <Button type="button" disabled={busy || !canLockDay || !ledger.canLock} onClick={onLock}>
                  {negativeLines.length ? "Còn tồn âm, chưa chốt" : "Chốt ngày"}
                </Button>
              )}
            </div>
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
