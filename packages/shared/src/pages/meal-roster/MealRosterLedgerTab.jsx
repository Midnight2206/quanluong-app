import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, Settings2 } from "lucide-react";
import { TabPanel } from "@/components/common/TabPanel";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/contexts/ConfirmProvider";
import {
  useGetMealRateCatalogQuery,
  useGetMealRosterDayMarksQuery,
  useGetMealRosterMetaQuery,
  useGetMealRosterQuery,
  usePutMealRosterDayMarksMutation,
  usePutSelectedMealRatesMutation,
} from "@/features/meal-roster/api/mealRosterApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import {
  allocatePeriodAmountsBySplit,
  buildStandardCycleOrderForCell,
  compactExtraMealChipLabel,
  daysInMonthFromYearMonth,
  DEFAULT_EXTRA_SPLIT_PERIODS,
  equalSplitThreePeriods,
  EXTRA_SPLIT_PRESET_OPTIONS,
  formatExtraSplitShort,
  formatMealAmountOnly,
  isDefaultExtraSplitPeriods,
  MEAL_ROSTER_PERIODS,
  mealRateTooltip,
  orderExtraSplitPeriods,
  localTodayYmd,
  lockedStandardRateForDay,
  periodAmountsForCalendarDay,
  presetValueForPeriods,
} from "./mealRosterUiUtils";

const inputClass =
  "w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function buildCellTitle({
  periodId,
  periodLabel,
  standardRate,
  extraRateObjs,
  extraSplitShort,
  dayPeriods,
  yearMonth,
  dayOfMonth,
}) {
  const lines = [`Buổi: ${periodLabel}`];
  if (extraSplitShort) {
    lines.push(`Chia «ăn thêm» trong ngày (chung danh sách): ${extraSplitShort}`);
  }
  if (standardRate) {
    const pa = periodAmountsForCalendarDay(standardRate, yearMonth, dayOfMonth);
    lines.push(
      `Tiêu chuẩn (buổi này): ${formatMealAmountOnly(pa[periodId])} đ — tổng ngày ${formatMealAmountOnly(standardRate.mucTienAn)} đ — ${mealRateTooltip(standardRate.doiTuong) ?? "—"}`,
    );
  } else {
    lines.push("Tiêu chuẩn: không chấm");
  }
  if (extraRateObjs.length > 0) {
    const parts = extraRateObjs.map((er) => {
      const weights = periodAmountsForCalendarDay(er, yearMonth, dayOfMonth);
      const alloc = allocatePeriodAmountsBySplit(er.mucTienAn, weights, dayPeriods);
      const thisP = alloc[periodId] ?? 0;
      return `${formatMealAmountOnly(thisP)} đ buổi này / ${formatMealAmountOnly(er.mucTienAn)} đ ngày — ${mealRateTooltip(er.doiTuong) ?? "—"}`;
    });
    lines.push(`Ăn thêm: ${parts.join("; ")}`);
  }
  return lines.join("\n");
}

function countCellsExtraWithoutStandard(localExtra, localStandard, localSplits) {
  let n = 0;
  for (const [k, ids] of Object.entries(localExtra)) {
    if (!Array.isArray(ids) || ids.length === 0) {
      continue;
    }
    const [eStr, dStr] = k.split(":");
    const day = Number(dStr);
    const periods =
      localSplits[day] && localSplits[day].length > 0
        ? orderExtraSplitPeriods(localSplits[day])
        : DEFAULT_EXTRA_SPLIT_PERIODS;
    for (const p of periods) {
      const sk = `${eStr}:${day}:${p}`;
      if (localStandard[sk] == null) {
        n += 1;
      }
    }
  }
  return n;
}

/**
 * @param {{ mode: 'standard' | 'extra' }} props
 */
function LedgerMarksTable({
  mode,
  dim,
  days,
  rows,
  localStandard,
  localExtra,
  localSplits,
  standardRateIds,
  extraRates,
  rateById,
  canAccess,
  needsMealRateSelection,
  yearMonth,
  cycleStandard,
  toggleExtra,
  setDaySplitPreset,
  loadingRows,
  loadingMarks,
}) {
  const showSplitHeader = mode === "extra";
  const showStandardEdit = mode === "standard";
  const showExtraChips = mode === "extra";

  /** Hai cột đầu neo ngang khi cuộn; không dùng sticky dọc (tránh lệch với tab). */
  const thName =
    "sticky left-0 z-30 w-36 min-w-36 max-w-36 border-b border-r border-border bg-muted/90 px-2 py-2 text-left text-[10px] font-semibold backdrop-blur-sm sm:text-xs";
  const thCb =
    "sticky left-36 z-30 w-10 min-w-10 border-b border-r border-border bg-muted/90 px-0.5 py-2 text-center text-[10px] font-semibold backdrop-blur-sm sm:text-xs";
  const tdName =
    "sticky left-0 z-10 w-36 min-w-36 max-w-36 border-r border-border/80 bg-background px-2 py-1 align-middle text-[10px] sm:text-xs";
  const tdCb =
    "sticky left-36 z-10 w-10 min-w-10 border-r border-border/80 bg-background px-0.5 py-1 text-center text-[10px] text-muted-foreground";
  const dayW = "w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] border-r border-border/40";

  return (
    <div className="min-w-0 overflow-x-auto rounded-md border border-border bg-card shadow-sm">
      <table className="w-max min-w-full border-collapse text-left text-[10px] sm:text-xs">
        <thead>
          <tr>
            <th className={thName}>Họ và tên</th>
            <th className={thCb}>CB</th>
            {days.map((d) => {
              const periodsForDay =
                localSplits[d] && localSplits[d].length > 0
                  ? orderExtraSplitPeriods(localSplits[d])
                  : DEFAULT_EXTRA_SPLIT_PERIODS;
              return (
                <th
                  key={d}
                  className={cn(
                    dayW,
                    "border-b border-border bg-muted/90 px-1 py-2 text-center align-top text-[10px] font-semibold tabular-nums backdrop-blur-sm",
                  )}
                >
                  <div className="text-foreground">{d}</div>
                  {showSplitHeader ? (
                    <>
                      <label className="sr-only" htmlFor={`meal-split-${d}`}>
                        Chia ăn thêm ngày {d}
                      </label>
                      <select
                        id={`meal-split-${d}`}
                        name={`mealLedgerExtraSplitDay_${d}`}
                        className="mt-1 box-border w-full min-w-0 rounded border border-border bg-background px-0.5 py-0.5 text-[7px] font-normal outline-none focus:border-primary sm:text-[8px]"
                        disabled={!canAccess || needsMealRateSelection || rows.length === 0}
                        value={presetValueForPeriods(periodsForDay)}
                        onChange={(e) => setDaySplitPreset(d, e.target.value)}
                        title="Cách chia tiền ăn thêm trong ngày (chung cả danh sách)"
                      >
                        {EXTRA_SPLIT_PRESET_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-[8px] font-normal text-muted-foreground">S / T / C</div>
                    </>
                  ) : (
                    <div className="mt-1 text-[8px] font-normal text-muted-foreground">S / T / C</div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loadingRows || loadingMarks ? (
            <tr>
              <td colSpan={2 + dim} className="px-3 py-8 text-center text-muted-foreground">
                <Loader2 className="mx-auto size-6 animate-spin opacity-60" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={2 + dim} className="px-3 py-6 text-center text-muted-foreground">
                Chưa có người trong danh sách bảo đảm tháng này — thêm ở tab «Danh sách bảo đảm».
              </td>
            </tr>
          ) : showExtraChips && extraRates.length === 0 ? (
            <tr>
              <td colSpan={2 + dim} className="px-3 py-6 text-center text-muted-foreground">
                Chưa có mức «ăn thêm» trong cấu hình đơn vị — bấm «Chọn mức tiền ăn cho đơn vị», tab «Ăn thêm», rồi lưu.
              </td>
            </tr>
          ) : showStandardEdit && standardRateIds.length === 0 ? (
            <tr>
              <td colSpan={2 + dim} className="px-3 py-6 text-center text-muted-foreground">
                Chưa có mức «ăn tiêu chuẩn» trong cấu hình đơn vị — bấm «Chọn mức tiền ăn cho đơn vị», tab «Ăn tiêu chuẩn», rồi lưu.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className={tdName}>
                  <span className="line-clamp-2 break-words">{r.fullName}</span>
                </td>
                <td className={tdCb}>{r.rank || "—"}</td>
                {days.map((d) => {
                  const dayPeriods =
                    localSplits[d] && localSplits[d].length > 0
                      ? orderExtraSplitPeriods(localSplits[d])
                      : DEFAULT_EXTRA_SPLIT_PERIODS;
                  const splitShort = formatExtraSplitShort(dayPeriods);
                  const extraKey = `${r.id}:${d}`;
                  const extraIds = localExtra[extraKey] ?? [];
                  const extraObjs = extraIds.map((id) => rateById.get(id)).filter(Boolean);
                  return (
                    <td key={`${r.id}:${d}`} className={cn(dayW, "border-border/30 p-0 align-top")}>
                      <div className="flex w-full min-w-0 flex-col divide-y divide-border/40">
                        {MEAL_ROSTER_PERIODS.map((p) => {
                          const key = `${r.id}:${d}:${p.id}`;
                          const stdId = localStandard[key];
                          const showExtraInPeriod = dayPeriods.includes(p.id);
                          const stdRate = stdId != null ? rateById.get(stdId) : null;
                          const title = buildCellTitle({
                            periodId: p.id,
                            periodLabel: p.label,
                            standardRate: stdRate,
                            extraRateObjs: showExtraChips && showExtraInPeriod ? extraObjs : [],
                            extraSplitShort:
                              showExtraChips && showExtraInPeriod && extraIds.length > 0 ? splitShort : undefined,
                            dayPeriods,
                            yearMonth,
                            dayOfMonth: d,
                          });
                          const stdDisabled = !canAccess || needsMealRateSelection || standardRateIds.length === 0;
                          const hasStd = stdId != null;
                          const extraWithoutStd =
                            showExtraChips && showExtraInPeriod && extraIds.length > 0 && !hasStd;
                          const cellTitle = extraWithoutStd
                            ? `${title}\n\n⚠ Có ăn thêm nhưng chưa chấm ăn tiêu chuẩn.`
                            : title;
                          return (
                            <div
                              key={key}
                              className={cn(
                                "relative flex gap-0.5 px-0.5 py-0.5 first:pt-0.5 last:pb-0.5",
                                hasStd && "bg-primary/10 dark:bg-primary/15",
                                extraWithoutStd &&
                                  "ring-1 ring-inset ring-amber-500/55 dark:ring-amber-400/45",
                              )}
                              title={cellTitle}
                            >
                              {extraWithoutStd ? (
                                <span className="absolute -right-0.5 -top-0.5 z-[1] flex size-3 items-center justify-center rounded-full bg-amber-500 text-background shadow-sm dark:bg-amber-400 dark:text-amber-950">
                                  <AlertTriangle className="size-2" aria-hidden />
                                  <span className="sr-only">Cảnh báo: có ăn thêm nhưng không chấm tiêu chuẩn</span>
                                </span>
                              ) : null}
                              <span className="w-2.5 shrink-0 pt-0.5 text-center text-[8px] font-semibold leading-none text-muted-foreground">
                                {p.short}
                              </span>
                              <div className="min-w-0 flex-1">
                                {showStandardEdit ? (
                                  <button
                                    type="button"
                                    disabled={stdDisabled}
                                    onClick={() => cycleStandard(r.id, d, p.id, r.mealAllowanceRateId)}
                                    className={cn(
                                      "min-h-[1.1rem] w-full rounded border border-transparent px-0.5 text-center text-[9px] font-semibold tabular-nums leading-tight transition-colors sm:text-[10px]",
                                      !stdDisabled && "cursor-pointer hover:border-primary/40 hover:bg-muted/60",
                                      stdDisabled && "cursor-default opacity-60",
                                    )}
                                  >
                                    {hasStd
                                      ? formatMealAmountOnly(
                                          periodAmountsForCalendarDay(stdRate, yearMonth, d)[p.id],
                                        )
                                      : "—"}
                                  </button>
                                ) : showExtraInPeriod && extraRates.length > 0 ? (
                                  <div className="flex min-h-[1.1rem] flex-wrap items-center justify-center gap-px py-0.5">
                                    {extraRates.map((er) => {
                                      const on = extraIds.includes(er.id);
                                      const alloc = allocatePeriodAmountsBySplit(
                                        er.mucTienAn,
                                        periodAmountsForCalendarDay(er, yearMonth, d),
                                        dayPeriods,
                                      );
                                      const thisExtra = alloc[p.id] ?? 0;
                                      return (
                                        <button
                                          key={er.id}
                                          type="button"
                                          disabled={!canAccess || needsMealRateSelection}
                                          title={`${er.label}\nBuổi này: ${formatMealAmountOnly(thisExtra)} đ / ngày ${formatMealAmountOnly(er.mucTienAn)} đ\n${on ? "Bấm để bỏ" : "Bấm để chấm"}`}
                                          onClick={() => toggleExtra(r.id, d, er.id)}
                                          className={cn(
                                            "min-w-[1.2rem] rounded px-px py-px text-[7px] font-semibold tabular-nums leading-none sm:text-[8px]",
                                            !needsMealRateSelection && canAccess && "cursor-pointer",
                                            on
                                              ? "border border-primary/50 bg-primary/15 text-primary"
                                              : "border border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/30",
                                          )}
                                        >
                                          {compactExtraMealChipLabel(er, thisExtra)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="min-h-[1.1rem] w-full" aria-hidden />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function MealRatePickerItem({ rate, checked, pickerAmounts, togglePickerId, patchPickerPeriodAmount }) {
  const pa = pickerAmounts[rate.id] ?? equalSplitThreePeriods(rate.mucTienAn);
  const sum = pa.sang + pa.trua + pa.chieu;
  const M = Number(rate.mucTienAn);
  const sumOk = sum === M;
  const checkId = `meal-rate-picker-${rate.id}-enabled`;
  return (
    <li className="rounded-md border border-border/60 bg-background/40 px-2 py-2">
      <label className="flex cursor-pointer items-start gap-2" htmlFor={checkId}>
        <input
          id={checkId}
          name={`mealRatePicker_${rate.id}_enabled`}
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          onChange={() => togglePickerId(rate.id)}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <span className="text-xs font-medium leading-snug text-foreground">{rate.label}</span>
          {checked ? (
            <div className="grid grid-cols-3 gap-2">
              {MEAL_ROSTER_PERIODS.map((mp) => {
                const periodInputId = `meal-rate-picker-${rate.id}-${mp.id}`;
                return (
                  <label key={mp.id} className="flex flex-col gap-0.5 text-[10px] text-muted-foreground" htmlFor={periodInputId}>
                    {mp.short} (đ)
                    <input
                      id={periodInputId}
                      name={`mealRatePicker_${rate.id}_${mp.id}`}
                      type="number"
                      min={0}
                      className={inputClass}
                      value={pa[mp.id]}
                      onChange={(e) => patchPickerPeriodAmount(rate.id, mp.id, e.target.value)}
                    />
                  </label>
                );
              })}
            </div>
          ) : null}
          {checked ? (
            <p
              className={cn(
                "text-[10px] tabular-nums",
                sumOk ? "text-muted-foreground" : "font-medium text-amber-700 dark:text-amber-300",
              )}
            >
              Tổng S+T+C: {formatMealAmountOnly(sum)} đ — cần {formatMealAmountOnly(M)} đ/ngày
            </p>
          ) : null}
        </div>
      </label>
    </li>
  );
}

export function MealRosterLedgerTab({
  selectedUnitId,
  yearMonth,
  setYearMonth,
  canAccess,
  canPickUnits,
  workingUnitId,
  sortedUnits,
  manualUnitId,
  setManualUnitId,
  user,
}) {
  const { confirm } = useConfirm();
  const skipBase = !selectedUnitId || !yearMonth || !canAccess;
  const { data: meta } = useGetMealRosterMetaQuery(
    { unitId: selectedUnitId, yearMonth },
    { skip: !selectedUnitId || !canAccess || !yearMonth },
  );
  const standardRates = meta?.rates ?? [];
  const extraRates = meta?.ratesExtra ?? [];
  const needsMealRateSelection = Boolean(meta?.needsMealRateSelection);

  const standardRateIds = useMemo(() => standardRates.map((r) => r.id), [standardRates]);
  const standardRateIdSet = useMemo(() => new Set(standardRateIds), [standardRateIds]);
  const extraRateIdSet = useMemo(() => new Set(extraRates.map((r) => r.id)), [extraRates]);

  const rateById = useMemo(() => {
    const m = new Map();
    for (const r of standardRates) {
      m.set(r.id, r);
    }
    for (const r of extraRates) {
      m.set(r.id, r);
    }
    return m;
  }, [standardRates, extraRates]);

  const { data: rows = [], isLoading: loadingRows } = useGetMealRosterQuery(
    { unitId: selectedUnitId, yearMonth },
    { skip: skipBase },
  );

  const { data: marksPayload, isFetching: loadingMarks } = useGetMealRosterDayMarksQuery(
    { unitId: selectedUnitId, yearMonth },
    { skip: skipBase },
  );
  const marksFromApi = marksPayload?.marks ?? [];
  const extraMarksFromApi = marksPayload?.extraMarks ?? [];
  const extraSplitsFromApi = marksPayload?.extraSplits ?? [];

  /** @type {Record<string, number>} */
  const [localStandard, setLocalStandard] = useState({});
  /** @type {Record<string, number[]>} key: entryId:day */
  const [localExtra, setLocalExtra] = useState({});
  /** @type {Record<number, string[]>} day -> periods */
  const [localSplits, setLocalSplits] = useState({});

  useEffect(() => {
    const nextStd = {};
    for (const m of marksFromApi) {
      if (m.mealAllowanceRateId != null) {
        const rid = m.mealAllowanceRateId;
        if (standardRateIdSet.size > 0 && !standardRateIdSet.has(rid)) {
          continue;
        }
        const period = m.mealPeriod ?? "trua";
        nextStd[`${m.mealRosterEntryId}:${m.dayOfMonth}:${period}`] = rid;
      }
    }
    setLocalStandard(nextStd);

    const nextEx = {};
    for (const m of extraMarksFromApi) {
      const rid = m.mealAllowanceRateId;
      if (extraRateIdSet.size > 0 && !extraRateIdSet.has(rid)) {
        continue;
      }
      const k = `${m.mealRosterEntryId}:${m.dayOfMonth}`;
      if (!nextEx[k]) {
        nextEx[k] = [];
      }
      nextEx[k].push(rid);
    }
    for (const k of Object.keys(nextEx)) {
      nextEx[k] = [...new Set(nextEx[k])].sort((a, b) => a - b);
    }
    setLocalExtra(nextEx);

    const nextSp = {};
    for (const s of extraSplitsFromApi) {
      nextSp[s.dayOfMonth] = orderExtraSplitPeriods(s.periods ?? DEFAULT_EXTRA_SPLIT_PERIODS);
    }
    setLocalSplits(nextSp);
  }, [
    marksFromApi,
    extraMarksFromApi,
    extraSplitsFromApi,
    standardRateIdSet,
    extraRateIdSet,
  ]);

  useEffect(() => {
    setLocalExtra((prev) => {
      if (extraRateIdSet.size === 0) {
        return Object.keys(prev).length === 0 ? prev : {};
      }
      let changed = false;
      const next = { ...prev };
      for (const [k, ids] of Object.entries(next)) {
        const filtered = ids.filter((id) => extraRateIdSet.has(id));
        if (filtered.length !== ids.length) {
          changed = true;
        }
        if (filtered.length === 0) {
          delete next[k];
        } else {
          next[k] = filtered;
        }
      }
      return changed ? next : prev;
    });
  }, [extraRateIdSet]);

  useEffect(() => {
    if (standardRateIdSet.size === 0) {
      return;
    }
    setLocalStandard((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [k, v] of Object.entries(next)) {
        if (v != null && !standardRateIdSet.has(v)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [standardRateIdSet]);

  const dim = useMemo(() => daysInMonthFromYearMonth(yearMonth), [yearMonth]);
  const days = useMemo(() => Array.from({ length: dim }, (_, i) => i + 1), [dim]);

  const cycleStandard = useCallback((entryId, day, mealPeriod, registeredRateId) => {
    if (standardRateIds.length === 0) {
      return;
    }
    const key = `${entryId}:${day}:${mealPeriod}`;
    setLocalStandard((prev) => {
      const lockedRate = lockedStandardRateForDay(prev, entryId, day, mealPeriod);
      const order = buildStandardCycleOrderForCell(standardRateIds, registeredRateId, lockedRate);
      const raw = prev[key];
      const currentNum =
        raw != null && raw !== "" && Number.isFinite(Number(raw)) && Number(raw) > 0
          ? Number(raw)
          : null;
      const normOrder = order.map((x) =>
        x != null && x !== "" && Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : null,
      );
      let idx = normOrder.findIndex((x) => x === currentNum);
      if (idx < 0) {
        idx = 0;
      }
      const nextIdx = (idx + 1) % normOrder.length;
      const next = normOrder[nextIdx];
      const n = { ...prev };
      if (next == null) {
        delete n[key];
      } else {
        for (const mp of MEAL_ROSTER_PERIODS) {
          if (mp.id === mealPeriod) {
            continue;
          }
          const k2 = `${entryId}:${day}:${mp.id}`;
          const v2 = n[k2];
          const v2n =
            v2 != null && v2 !== "" && Number.isFinite(Number(v2)) && Number(v2) > 0 ? Number(v2) : null;
          if (v2n != null && v2n !== next) {
            delete n[k2];
          }
        }
        n[key] = next;
      }
      return n;
    });
  }, [standardRateIds]);

  const toggleExtra = useCallback((entryId, day, rateId) => {
    const key = `${entryId}:${day}`;
    setLocalExtra((prev) => {
      const cur = prev[key] ?? [];
      const has = cur.includes(rateId);
      const nextArr = has ? cur.filter((id) => id !== rateId) : [...cur, rateId].sort((a, b) => a - b);
      const n = { ...prev };
      if (nextArr.length === 0) {
        delete n[key];
      } else {
        n[key] = nextArr;
      }
      return n;
    });
  }, []);

  const [putMarks, { isLoading: savingMarks }] = usePutMealRosterDayMarksMutation();

  const handleSaveLedger = useCallback(async () => {
    if (!selectedUnitId) {
      return;
    }
    const warnCount = countCellsExtraWithoutStandard(localExtra, localStandard, localSplits);
    if (warnCount > 0) {
      const ok = await confirm({
        title: "Cảnh báo chấm cơm",
        message: `Có ${warnCount} buổi (thuộc cách chia ăn thêm trong ngày) đang bật «ăn thêm» nhưng không chấm «ăn tiêu chuẩn» (—). Bạn có chắc vẫn muốn lưu?`,
        confirmLabel: "Vẫn lưu",
      });
      if (!ok) {
        return;
      }
    }
    const marks = Object.entries(localStandard)
      .filter(
        ([, mealAllowanceRateId]) =>
          mealAllowanceRateId != null &&
          (standardRateIdSet.size === 0 || standardRateIdSet.has(mealAllowanceRateId)),
      )
      .map(([k, mealAllowanceRateId]) => {
        const [eStr, dStr, mealPeriod] = k.split(":");
        return {
          mealRosterEntryId: Number(eStr),
          dayOfMonth: Number(dStr),
          mealPeriod,
          mealAllowanceRateId,
        };
      });
    const extraMarks = [];
    for (const [k, ids] of Object.entries(localExtra)) {
      const [eStr, dStr] = k.split(":");
      const mealRosterEntryId = Number(eStr);
      const dayOfMonth = Number(dStr);
      for (const mealAllowanceRateId of ids) {
        if (extraRateIdSet.size === 0 || !extraRateIdSet.has(mealAllowanceRateId)) {
          continue;
        }
        extraMarks.push({ mealRosterEntryId, dayOfMonth, mealAllowanceRateId });
      }
    }
    const extraSplits = [];
    const dimSave = daysInMonthFromYearMonth(yearMonth);
    for (let d = 1; d <= dimSave; d += 1) {
      const periods =
        localSplits[d] && localSplits[d].length > 0
          ? orderExtraSplitPeriods(localSplits[d])
          : DEFAULT_EXTRA_SPLIT_PERIODS;
      if (!isDefaultExtraSplitPeriods(periods)) {
        extraSplits.push({ dayOfMonth: d, periods });
      }
    }
    try {
      await putMarks({ unitId: selectedUnitId, yearMonth, marks, extraMarks, extraSplits }).unwrap();
      notifySuccess("Đã lưu sổ chấm cơm");
    } catch (e) {
      notifyError(e?.data?.message || "Không lưu được sổ");
    }
  }, [
    confirm,
    extraRateIdSet,
    localExtra,
    localSplits,
    localStandard,
    putMarks,
    selectedUnitId,
    standardRateIdSet,
    yearMonth,
  ]);

  const setDaySplitPreset = useCallback((day, presetValue) => {
    const opt = EXTRA_SPLIT_PRESET_OPTIONS.find((o) => o.value === presetValue);
    if (!opt) {
      return;
    }
    setLocalSplits((prev) => {
      const next = { ...prev };
      if (isDefaultExtraSplitPeriods(opt.periods)) {
        delete next[day];
      } else {
        next[day] = [...opt.periods];
      }
      return next;
    });
  }, []);

  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: catalogPayload, isFetching: loadingCatalog } = useGetMealRateCatalogQuery(undefined, {
    skip: !pickerOpen,
  });
  const catalogRates = catalogPayload?.rates ?? [];
  const catalogRatesStandard = useMemo(
    () => catalogRates.filter((r) => r.type === "an_tieu_chuan"),
    [catalogRates],
  );
  const catalogRatesExtra = useMemo(
    () => catalogRates.filter((r) => r.type === "an_them"),
    [catalogRates],
  );
  const [pickerIds, setPickerIds] = useState(() => new Set());
  /** @type {Record<number, { sang: number, trua: number, chieu: number }>} */
  const [pickerAmounts, setPickerAmounts] = useState({});
  const [pickerSplitValidFrom, setPickerSplitValidFrom] = useState(() => localTodayYmd());
  const pickerOpenWasInitialized = useRef(false);

  useEffect(() => {
    if (!pickerOpen) {
      pickerOpenWasInitialized.current = false;
      return;
    }
    if (catalogRates.length === 0 || pickerOpenWasInitialized.current) {
      return;
    }
    pickerOpenWasInitialized.current = true;
    setPickerSplitValidFrom(localTodayYmd());
    const all = [...standardRates, ...extraRates];
    const nextIds = new Set(all.map((r) => r.id));
    setPickerIds(nextIds);
    const nextA = {};
    for (const r of all) {
      const cat = catalogRates.find((c) => c.id === r.id);
      const M = Number(cat?.mucTienAn ?? r.mucTienAn ?? 0);
      nextA[r.id] = r.periodAmounts ? { ...r.periodAmounts } : equalSplitThreePeriods(M);
    }
    setPickerAmounts(nextA);
  }, [pickerOpen, standardRates, extraRates, catalogRates]);

  const [putSelected, { isLoading: savingPicker }] = usePutSelectedMealRatesMutation();

  const togglePickerId = useCallback(
    (id) => {
      setPickerIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          setPickerAmounts((p) => {
            const q = { ...p };
            delete q[id];
            return q;
          });
        } else {
          next.add(id);
          const cat = catalogRates.find((c) => c.id === id);
          const M = Number(cat?.mucTienAn ?? 0);
          const meta = [...standardRates, ...extraRates].find((r) => r.id === id);
          const init = meta?.periodAmounts ? { ...meta.periodAmounts } : equalSplitThreePeriods(M);
          setPickerAmounts((p) => ({ ...p, [id]: init }));
        }
        return next;
      });
    },
    [catalogRates, standardRates, extraRates],
  );

  const patchPickerPeriodAmount = useCallback((rateId, field, raw) => {
    const v = Math.max(0, Math.floor(Number(raw) || 0));
    setPickerAmounts((p) => {
      const cur = p[rateId] ?? { sang: 0, trua: 0, chieu: 0 };
      return {
        ...p,
        [rateId]: { ...cur, [field]: v },
      };
    });
  }, []);

  const handleSavePicker = useCallback(async () => {
    if (!selectedUnitId) {
      return;
    }
    if (pickerIds.size === 0) {
      notifyError("Chọn ít nhất một mức");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickerSplitValidFrom)) {
      notifyError("Chọn «Áp dụng tỉ lệ từ ngày» đúng dạng YYYY-MM-DD");
      return;
    }
    for (const id of pickerIds) {
      const cat = catalogRates.find((c) => c.id === id);
      const M = Number(cat?.mucTienAn);
      const pa = pickerAmounts[id];
      if (!cat || !pa) {
        notifyError("Thiếu dữ liệu mức — đợi tải danh mục hoặc chọn lại");
        return;
      }
      const sum = pa.sang + pa.trua + pa.chieu;
      if (sum !== M) {
        notifyError(
          `Mức «${cat.label ?? id}»: tổng S+T+C phải bằng ${formatMealAmountOnly(M)} đ/ngày (đang ${formatMealAmountOnly(sum)} đ)`,
        );
        return;
      }
    }
    try {
      const selections = [...pickerIds].map((id) => ({
        mealAllowanceRateId: id,
        periodAmounts: pickerAmounts[id],
      }));
      await putSelected({
        unitId: selectedUnitId,
        periodSplitValidFrom: pickerSplitValidFrom,
        selections,
      }).unwrap();
      notifySuccess("Đã cập nhật mức tiền ăn cho đơn vị");
      setPickerOpen(false);
    } catch (e) {
      notifyError(e?.data?.message || "Không lưu được");
    }
  }, [pickerIds, pickerAmounts, pickerSplitValidFrom, putSelected, selectedUnitId, catalogRates]);

  const unitLabel =
    sortedUnits.find((u) => Number(u.id) === Number(selectedUnitId))?.name ??
    user?.unit?.name ??
    (selectedUnitId ? `#${selectedUnitId}` : "—");

  const ledgerGridProps = useMemo(
    () => ({
      dim,
      days,
      rows,
      localStandard,
      localExtra,
      localSplits,
      standardRateIds,
      extraRates,
      rateById,
      canAccess,
      needsMealRateSelection,
      yearMonth,
      cycleStandard,
      toggleExtra,
      setDaySplitPreset,
      loadingRows,
      loadingMarks,
    }),
    [
      dim,
      days,
      rows,
      localStandard,
      localExtra,
      localSplits,
      standardRateIds,
      extraRates,
      rateById,
      canAccess,
      needsMealRateSelection,
      yearMonth,
      cycleStandard,
      toggleExtra,
      setDaySplitPreset,
      loadingRows,
      loadingMarks,
    ],
  );

  const busy = savingMarks || savingPicker;
  const ledgerHasRates = standardRates.length > 0 || extraRates.length > 0;
  const extraWithoutStandardCount = useMemo(
    () => countCellsExtraWithoutStandard(localExtra, localStandard, localSplits),
    [localExtra, localStandard, localSplits],
  );

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {canPickUnits ? (
          <label
            className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground"
            htmlFor="meal-ledger-unitId"
          >
            Đơn vị
            <select
              id="meal-ledger-unitId"
              name="mealLedgerUnitId"
              className={cn(inputClass, "max-w-md")}
              value={selectedUnitId ?? ""}
              onChange={(e) => setManualUnitId(Number(e.target.value))}
            >
              {sortedUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] font-normal text-muted-foreground">
              {workingUnitId != null
                ? "«Đơn vị đang xem» đặt mặc định; có thể đổi trong danh sách."
                : "Chọn đơn vị trong phạm vi được phép."}
            </span>
          </label>
        ) : (
          <div className="text-sm text-muted-foreground">
            Đơn vị: <span className="font-medium text-foreground">{unitLabel}</span>
          </div>
        )}
        <label
          className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-muted-foreground"
          htmlFor="meal-ledger-yearMonth"
        >
          Tháng
          <input
            id="meal-ledger-yearMonth"
            name="mealLedgerYearMonth"
            type="month"
            className={inputClass}
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2"
            disabled={!selectedUnitId || !canAccess}
            onClick={() => setPickerOpen(true)}
          >
            <Settings2 className="size-4" />
            Chọn mức tiền ăn cho đơn vị
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={
              busy || !selectedUnitId || !canAccess || needsMealRateSelection || rows.length === 0 || !ledgerHasRates
            }
            onClick={() => void handleSaveLedger()}
          >
            {savingMarks ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Lưu sổ chấm
          </Button>
        </div>
      </div>

      {!selectedUnitId ? (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          Chưa chọn đơn vị — không thể mở sổ chấm.
        </p>
      ) : null}
      {selectedUnitId && canAccess && needsMealRateSelection ? (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          Bấm «Chọn mức tiền ăn cho đơn vị» để bật các mức dùng trong sổ (ăn tiêu chuẩn và/hoặc ăn thêm).
        </p>
      ) : null}

      <TabPanel
        persistId="meal-roster-ledger-marks"
        defaultTabId="standard"
        scrollablePanel={false}
        stickyTabList
        stickyTabListTopClassName="top-12 sm:top-14"
        tabs={[
          {
            id: "standard",
            label: "Ăn tiêu chuẩn",
            panel: <LedgerMarksTable mode="standard" {...ledgerGridProps} />,
          },
          {
            id: "extra",
            label: "Ăn thêm",
            badge:
              extraWithoutStandardCount > 0 ? (
                <span
                  className="inline-flex max-w-[14rem] items-center gap-1 whitespace-nowrap rounded-md border border-amber-500/45 bg-amber-500/10 px-1.5 py-px text-[10px] font-normal normal-case leading-tight text-amber-950 dark:text-amber-50 sm:max-w-[18rem] sm:text-[11px]"
                  title={`Có ${extraWithoutStandardCount} buổi (thuộc cách chia ăn thêm trong ngày) đang bật «ăn thêm» nhưng chưa chấm «ăn tiêu chuẩn» buổi đó. Khi lưu sẽ hỏi xác nhận.`}
                >
                  <AlertTriangle
                    className="size-3 shrink-0 text-amber-600 dark:text-amber-300"
                    aria-hidden
                  />
                  <span className="tabular-nums font-semibold">{extraWithoutStandardCount}</span>
                  <span className="hidden min-[380px]:inline">thiếu tiêu chuẩn</span>
                  <span className="min-[380px]:hidden">thiếu TC</span>
                </span>
              ) : undefined,
            panel: <LedgerMarksTable mode="extra" {...ledgerGridProps} />,
          },
        ]}
      />

      {pickerOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 backdrop-blur-[1px]"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setPickerOpen(false);
                }
              }}
            >
              <div
                className="max-h-[min(85vh,100dvh)] w-full min-w-0 max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-float"
                role="dialog"
                aria-modal="true"
                aria-labelledby="meal-rate-picker-title"
              >
            <div className="border-b border-border px-4 py-3">
              <h2 id="meal-rate-picker-title" className="text-sm font-semibold">
                Mức tiền ăn áp dụng cho đơn vị
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Chọn mức ở từng tab <span className="font-medium text-foreground">Ăn tiêu chuẩn</span> /{" "}
                <span className="font-medium text-foreground">Ăn thêm</span>. Với mỗi mức đã tích, nhập Sáng / Trưa /
                Chiều (tổng bằng mức /ngày theo Thông tư). Ngày chỉ chia 1–2 bữa «ăn thêm» trên sổ thì tiền phân theo tỉ
                lệ ba buổi đã nhập.
              </p>
              <label
                className="mt-3 flex flex-col gap-1 text-xs font-medium text-muted-foreground"
                htmlFor="meal-rate-picker-split-valid-from"
              >
                Áp dụng tỉ lệ S/T/C từ ngày (lịch)
                <input
                  id="meal-rate-picker-split-valid-from"
                  name="mealRatePickerSplitValidFrom"
                  type="date"
                  className={inputClass}
                  value={pickerSplitValidFrom}
                  onChange={(e) => setPickerSplitValidFrom(e.target.value)}
                  title="Từ ngày này trở đi dùng tỉ lệ vừa lưu; các ngày trước vẫn theo cấu hình cũ"
                />
                <span className="text-[10px] font-normal leading-snug">
                  Các tháng/ngày trên sổ <span className="font-medium text-foreground">trước</span> ngày này giữ đúng tiền
                  theo tỉ lệ đã lưu trước đó.
                </span>
              </label>
            </div>
            <div className="flex min-h-[12rem] max-h-[50vh] flex-col overflow-hidden p-3">
              {loadingCatalog ? (
                <div className="flex flex-1 justify-center py-8 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : (
                <TabPanel
                  persistId="meal-rate-picker-catalog"
                  defaultTabId="standard"
                  className="min-h-0 flex-1"
                  tabs={[
                    {
                      id: "standard",
                      label: "Ăn tiêu chuẩn",
                      panel: (
                        <ul className="space-y-3">
                          {catalogRatesStandard.length === 0 ? (
                            <li className="rounded-md border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
                              Không có mức «ăn tiêu chuẩn» trong danh mục hệ thống.
                            </li>
                          ) : (
                            catalogRatesStandard.map((rate) => (
                              <MealRatePickerItem
                                key={rate.id}
                                rate={rate}
                                checked={pickerIds.has(rate.id)}
                                pickerAmounts={pickerAmounts}
                                togglePickerId={togglePickerId}
                                patchPickerPeriodAmount={patchPickerPeriodAmount}
                              />
                            ))
                          )}
                        </ul>
                      ),
                    },
                    {
                      id: "extra",
                      label: "Ăn thêm",
                      panel: (
                        <ul className="space-y-3">
                          {catalogRatesExtra.length === 0 ? (
                            <li className="rounded-md border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
                              Không có mức «ăn thêm» trong danh mục hệ thống.
                            </li>
                          ) : (
                            catalogRatesExtra.map((rate) => (
                              <MealRatePickerItem
                                key={rate.id}
                                rate={rate}
                                checked={pickerIds.has(rate.id)}
                                pickerAmounts={pickerAmounts}
                                togglePickerId={togglePickerId}
                                patchPickerPeriodAmount={patchPickerPeriodAmount}
                              />
                            ))
                          )}
                        </ul>
                      ),
                    },
                  ]}
                />
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-muted/20 px-4 py-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>
                Hủy
              </Button>
              <Button type="button" size="sm" disabled={savingPicker} onClick={() => void handleSavePicker()}>
                {savingPicker ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Lưu cấu hình
              </Button>
            </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
