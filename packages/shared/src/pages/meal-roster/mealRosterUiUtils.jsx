export function formatMealAmountOnly(mucTienAn) {
  const n = Number(mucTienAn);
  if (!Number.isFinite(n)) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function mealRateTooltip(doiTuong) {
  const t = String(doiTuong ?? "")
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t || undefined;
}

export function MealRateDetailTooltipContent({ rate }) {
  if (!rate) {
    return (
      <p className="text-base leading-snug text-muted-foreground">
        Chọn một mức trong ô bên cạnh để xem đối tượng và quy định theo Thông tư.
      </p>
    );
  }
  const doi = mealRateTooltip(rate.doiTuong);
  const typeLine =
    rate.type === "an_them" ? "Ăn thêm" : rate.type === "an_tieu_chuan" ? "Ăn tiêu chuẩn" : null;
  const pa = periodAmountsForRate(rate);
  return (
    <div className="space-y-3">
      {typeLine ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{typeLine}</p>
      ) : null}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mức / người / ngày</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {formatMealAmountOnly(rate.mucTienAn)} đ
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chia theo buổi (đơn vị)</p>
        <p className="mt-1 text-sm tabular-nums text-foreground">
          S {formatMealAmountOnly(pa.sang)} · T {formatMealAmountOnly(pa.trua)} · C {formatMealAmountOnly(pa.chieu)}
        </p>
        {rate.type === "an_them" ? (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Ngày chỉ bật 1–2 buổi «ăn thêm», tiền được phân theo tỉ lệ ba buổi này.
          </p>
        ) : null}
      </div>
      {doi ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Đối tượng (Thông tư)</p>
          <p className="mt-1 text-lg font-normal leading-relaxed">{doi}</p>
        </div>
      ) : null}
    </div>
  );
}

export function prevYearMonthLabel(ym) {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return "";
  }
  const d = new Date(y, m - 2, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

/** Buổi chấm trong sổ cơm (theo tháng). */
export const MEAL_ROSTER_PERIODS = [
  { id: "sang", label: "Sáng", short: "S" },
  { id: "trua", label: "Trưa", short: "T" },
  { id: "chieu", label: "Chiều", short: "C" },
];

/** Chia đều tổng `totalM` (đồng) cho 3 buổi; phần dư gán S → T → C. */
export function equalSplitThreePeriods(totalM) {
  const M = Math.max(0, Math.floor(Number(totalM)));
  const base = Math.floor(M / 3);
  let rem = M - base * 3;
  const out = { sang: base, trua: base, chieu: base };
  const order = ["sang", "trua", "chieu"];
  for (let i = 0; i < rem; i += 1) {
    out[order[i]] += 1;
  }
  return out;
}

/**
 * `periodAmounts` do đơn vị cấu hình (tổng = mucTienAn). Thiếu thì coi như chia đều.
 * @param {{ mucTienAn?: number, periodAmounts?: { sang?: number, trua?: number, chieu?: number } }|null|undefined} rate
 */
export function periodAmountsForRate(rate) {
  const M = Math.max(0, Math.floor(Number(rate?.mucTienAn ?? 0)));
  const pa = rate?.periodAmounts;
  if (
    pa &&
    typeof pa === "object" &&
    [pa.sang, pa.trua, pa.chieu].every((n) => Number.isFinite(Number(n)) && Number(n) >= 0)
  ) {
    const sang = Math.round(Number(pa.sang));
    const trua = Math.round(Number(pa.trua));
    const chieu = Math.round(Number(pa.chieu));
    if (sang + trua + chieu === M && M >= 0) {
      return { sang, trua, chieu };
    }
  }
  return equalSplitThreePeriods(M);
}

/** Ngày hôm nay (local) dạng YYYY-MM-DD — dùng cho «áp dụng từ». */
export function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Tỉ lệ S/T/C áp dụng cho **một ngày lịch** trong tháng sổ (theo `periodSplitVersions` từ API).
 * @param {{ mucTienAn?: number, periodAmounts?: object, periodSplitVersions?: { validFrom: string, periodAmounts: object }[] }} rate
 */
export function periodAmountsForCalendarDay(rate, yearMonth, dayOfMonth) {
  const ym = String(yearMonth ?? "").trim();
  const d = Math.max(1, Math.floor(Number(dayOfMonth)));
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    return periodAmountsForRate(rate);
  }
  const ymd = `${ym}-${String(d).padStart(2, "0")}`;
  const versions = rate?.periodSplitVersions;
  if (Array.isArray(versions) && versions.length > 0) {
    const sorted = [...versions].sort((a, b) => String(a.validFrom).localeCompare(String(b.validFrom)));
    let chosen = null;
    for (const v of sorted) {
      if (String(v.validFrom) <= ymd) {
        chosen = v.periodAmounts;
      }
    }
    if (chosen && typeof chosen === "object") {
      return periodAmountsForRate({ mucTienAn: rate.mucTienAn, periodAmounts: chosen });
    }
  }
  return periodAmountsForRate(rate);
}

/**
 * Phân bổ tổng `totalM` cho các buổi đang dùng theo tỉ lệ trọng số S/T/C (số nguyên, tổng có thể ≠ totalM — chỉ dùng tỉ lệ).
 * @param {number} totalM
 * @param {{ sang: number, trua: number, chieu: number }} weights
 * @param {string[]} activePeriods — ví dụ `['sang','trua']`
 * @returns {Record<string, number>}
 */
export function allocatePeriodAmountsBySplit(totalM, weights, activePeriods) {
  const M = Math.max(0, Math.floor(Number(totalM)));
  const periods = orderExtraSplitPeriods(activePeriods);
  if (periods.length === 0) {
    return {};
  }
  const w = {
    sang: Math.max(0, Number(weights.sang) || 0),
    trua: Math.max(0, Number(weights.trua) || 0),
    chieu: Math.max(0, Number(weights.chieu) || 0),
  };
  let sumW = 0;
  for (const p of periods) {
    sumW += w[p] ?? 0;
  }
  if (sumW <= 0) {
    const base = Math.floor(M / periods.length);
    let rem = M - base * periods.length;
    const out = {};
    for (let i = 0; i < periods.length; i += 1) {
      out[periods[i]] = base + (i < rem ? 1 : 0);
    }
    return out;
  }
  const fr = periods.map((p) => {
    const share = (M * (w[p] ?? 0)) / sumW;
    return { p, share, f: Math.floor(share), frac: share - Math.floor(share) };
  });
  const sumF = fr.reduce((a, x) => a + x.f, 0);
  let rem = M - sumF;
  fr.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < rem; i += 1) {
    fr[i % fr.length].f += 1;
  }
  return Object.fromEntries(fr.map((x) => [x.p, x.f]));
}

/** Mặc định: chia ăn thêm vào cả 3 buổi. */
export const DEFAULT_EXTRA_SPLIT_PERIODS = ["sang", "trua", "chieu"];

const PERIOD_ORDER = ["sang", "trua", "chieu"];

/** Sắp xếp buổi theo S → T → C, bỏ trùng. */
export function orderExtraSplitPeriods(periods) {
  const uniq = [...new Set(periods)];
  return uniq.sort((a, b) => PERIOD_ORDER.indexOf(a) - PERIOD_ORDER.indexOf(b));
}

export function isDefaultExtraSplitPeriods(periods) {
  const p = orderExtraSplitPeriods(periods);
  return p.length === 3 && p[0] === "sang" && p[1] === "trua" && p[2] === "chieu";
}

/** Preset chia «ăn thêm» trong ngày (chung cả danh sách). */
export const EXTRA_SPLIT_PRESET_OPTIONS = [
  { value: "3", periods: ["sang", "trua", "chieu"], label: "3 bữa (S+T+C)" },
  { value: "2_st", periods: ["sang", "trua"], label: "2 bữa: S+T" },
  { value: "2_tc", periods: ["trua", "chieu"], label: "2 bữa: T+C" },
  { value: "2_sc", periods: ["sang", "chieu"], label: "2 bữa: S+C" },
  { value: "1_s", periods: ["sang"], label: "1 bữa: Sáng" },
  { value: "1_t", periods: ["trua"], label: "1 bữa: Trưa" },
  { value: "1_c", periods: ["chieu"], label: "1 bữa: Chiều" },
];

export function presetValueForPeriods(periods) {
  const o = orderExtraSplitPeriods(periods);
  const found = EXTRA_SPLIT_PRESET_OPTIONS.find(
    (x) => x.periods.length === o.length && x.periods.every((p, i) => p === o[i]),
  );
  return found?.value ?? "3";
}

/** Nhãn ngắn cho tooltip, ví dụ «S+T». */
export function formatExtraSplitShort(periods) {
  const o = orderExtraSplitPeriods(periods);
  const map = { sang: "S", trua: "T", chieu: "C" };
  return o.map((p) => map[p] ?? p).join("+");
}

/**
 * Thứ tự xoay vòng ô tiêu chuẩn: không chấm → mức đã đăng ký (nếu nằm trong tập đơn vị) → các mức tiêu chuẩn khác.
 * @param {number[]} standardRateIds
 * @param {number|undefined|null} registeredRateId — `MealRosterEntry.mealAllowanceRateId`
 */
export function buildStandardCycleOrder(standardRateIds, registeredRateId) {
  const ids = Array.isArray(standardRateIds) ? standardRateIds : [];
  const reg = Number(registeredRateId);
  if (Number.isInteger(reg) && reg > 0 && ids.includes(reg)) {
    return [null, reg, ...ids.filter((id) => id !== reg)];
  }
  return [null, ...ids];
}

/**
 * Mức «ăn tiêu chuẩn» đã chấm ở các buổi khác cùng ngày (cùng dòng), nếu thống nhất một giá trị.
 * @param {Record<string, number|null|undefined>} localStandard — key `entryId:day:period`
 */
export function lockedStandardRateForDay(localStandard, entryId, day, excludeMealPeriod) {
  const uniq = new Set();
  for (const mp of MEAL_ROSTER_PERIODS) {
    if (mp.id === excludeMealPeriod) {
      continue;
    }
    const v = localStandard[`${entryId}:${day}:${mp.id}`];
    if (v != null && v !== "" && Number.isFinite(Number(v)) && Number(v) > 0) {
      uniq.add(Number(v));
    }
  }
  if (uniq.size !== 1) {
    return null;
  }
  return [...uniq][0];
}

/**
 * Khi buổi khác trong ngày đã chấm mức R: chỉ xoay (—) ↔ R. Chưa có buổi nào chấm: xoay đủ các mức đơn vị.
 */
export function buildStandardCycleOrderForCell(standardRateIds, registeredRateId, lockedRate) {
  const lr =
    lockedRate != null && lockedRate !== "" && Number.isFinite(Number(lockedRate)) && Number(lockedRate) > 0
      ? Number(lockedRate)
      : null;
  if (lr != null) {
    return [null, lr];
  }
  return buildStandardCycleOrder(standardRateIds, registeredRateId);
}

export function daysInMonthFromYearMonth(ym) {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return 31;
  }
  return new Date(y, m, 0).getDate();
}

/** Nhãn gọn trong ô sổ chấm (Excel-like). */
export function shortRateOptionLabel(rate, mealPeriodId) {
  const tag = rate?.type === "an_them" ? "+" : "";
  const pa = periodAmountsForRate(rate);
  const per =
    mealPeriodId === "sang" || mealPeriodId === "trua" || mealPeriodId === "chieu"
      ? pa[mealPeriodId]
      : rate?.mucTienAn;
  return `${tag}${formatMealAmountOnly(per)}`;
}

/** Chip «ăn thêm» trong ô (ví dụ +45k) — có thể truyền số tiền buổi này. */
export function compactExtraMealChipLabel(rate, amountThisPeriod) {
  const n = Number(amountThisPeriod ?? rate?.mucTienAn);
  if (!Number.isFinite(n)) {
    return "+?";
  }
  if (n > 0 && n % 1000 === 0) {
    return `+${n / 1000}k`;
  }
  const k = n / 1000;
  return `+${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(k)}k`;
}
