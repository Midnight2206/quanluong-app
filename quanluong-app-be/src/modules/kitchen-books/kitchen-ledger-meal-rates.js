/**
 * Mức ăn của sổ lấy từ mức đơn vị đã chọn (UnitSelectedMealRate)
 * và chia sáng/trưa/chiều (UnitMealPeriodSplit, lưu bằng đồng).
 * Phần trăm trên màn hình đổi sang đồng theo phần dư lớn nhất.
 */
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const MEAL_KEYS = ["sang", "trua", "chieu"];
const DEFAULT_PERCENTS = { sang: 20, trua: 40, chieu: 40 };

function percentsToAmounts(mucTienAn, percents) {
  const total = Math.floor(Number(mucTienAn));
  const shares = MEAL_KEYS.map((key) => ({
    key,
    share: (total * Number(percents?.[key] || 0)) / 100,
  }));
  const floors = shares.map((row) => ({
    key: row.key,
    amount: Math.floor(row.share),
    frac: row.share - Math.floor(row.share),
  }));
  let remain = total - floors.reduce((sum, row) => sum + row.amount, 0);
  const order = [...floors].sort((a, b) => b.frac - a.frac || MEAL_KEYS.indexOf(a.key) - MEAL_KEYS.indexOf(b.key));
  for (let i = 0; i < remain; i += 1) order[i % order.length].amount += 1;
  return Object.fromEntries(floors.map((row) => [row.key, row.amount]));
}

function amountsToPercents(mucTienAn, amounts) {
  const total = Number(mucTienAn);
  if (!Number.isFinite(total) || total <= 0) return { sang: 0, trua: 0, chieu: 0 };
  const rounded = MEAL_KEYS.map((key) => ({
    key,
    percent: Math.round((Number(amounts?.[key] || 0) * 10000) / total) / 100,
  }));
  const drift = Math.round((100 - rounded.reduce((sum, row) => sum + row.percent, 0)) * 100) / 100;
  const index = rounded.reduce((best, row, i) => (row.percent > rounded[best].percent ? i : best), 0);
  rounded[index].percent = Math.round((rounded[index].percent + drift) * 100) / 100;
  return Object.fromEntries(rounded.map((row) => [row.key, row.percent]));
}

function parseAmounts(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const key of MEAL_KEYS) {
    const n = Math.round(Number(raw[key]));
    if (!Number.isInteger(n) || n < 0) return null;
    out[key] = n;
  }
  return out;
}

function riceGramsFor(dailyAmount, fallbackLevels) {
  const hit = (fallbackLevels || []).find((level) => Number(level.dailyAmount) === Number(dailyAmount));
  return hit?.riceGrams || { sang: 140, trua: 270, chieu: 270 };
}

function amountsForRate(rate, splitRows, fallbackLevels) {
  const muc = Math.floor(Number(rate.mucTienAn));
  const latest = (splitRows || []).filter((row) => row.mealAllowanceRateId === rate.id).at(-1);
  const stored = parseAmounts(latest?.periodAmountsJson);
  if (stored && stored.sang + stored.trua + stored.chieu === muc) return stored;
  const known = (fallbackLevels || []).find((level) => Number(level.dailyAmount) === muc);
  const knownAmounts = parseAmounts(known?.mealPrices);
  if (knownAmounts && knownAmounts.sang + knownAmounts.trua + knownAmounts.chieu === muc) return knownAmounts;
  return percentsToAmounts(muc, DEFAULT_PERCENTS);
}

function levelsFromSelection(selected, fallbackLevels) {
  return selected.map((rate) => ({
    code: String(rate.id),
    rateId: rate.id,
    dailyAmount: rate.mucTienAn,
    mealPrices: rate.periodAmounts,
    riceGrams: riceGramsFor(rate.mucTienAn, fallbackLevels),
  }));
}

function alignHeadcount(raw, settingsLevels) {
  const saved = Array.isArray(raw?.levels) ? raw.levels : [];
  const levels = (settingsLevels || []).map((level) => {
    const hit = saved.find((row) => (
      (level.code && String(row.code) === String(level.code))
      || Number(row.dailyAmount) === Number(level.dailyAmount)
    ));
    return {
      code: level.code ?? "",
      dailyAmount: Number(level.dailyAmount),
      sang: Number(hit?.sang) || 0,
      trua: Number(hit?.trua) || 0,
      chieu: Number(hit?.chieu) || 0,
    };
  });
  return {
    levels,
    extras: {
      benhXa: Number(raw?.extras?.benhXa) || 0,
      benhNhan: Number(raw?.extras?.benhNhan) || 0,
      omTrai: Number(raw?.extras?.omTrai) || 0,
      leTet: Number(raw?.extras?.leTet) || 0,
    },
  };
}

function asOfDate(ymd) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function assertPercentTotal(percents, rateId) {
  const nums = MEAL_KEYS.map((key) => Number(percents?.[key]));
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
    throw new AppError({
      message: `Mức #${rateId}: sáng, trưa, chiều phải là phần trăm từ 0 đến 100.`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const sum = Math.round(nums.reduce((acc, n) => acc + n, 0) * 100) / 100;
  if (Math.abs(sum - 100) > 0.05) {
    throw new AppError({
      message: `Mức #${rateId}: sáng + trưa + chiều phải bằng 100% (đang ${sum}%).`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return { sang: nums[0], trua: nums[1], chieu: nums[2] };
}

async function loadMealRatePanel(db, unitId, asOfYmd, fallbackLevels) {
  if (typeof db.mealAllowanceRate?.findMany !== "function" || typeof db.unitSelectedMealRate?.findMany !== "function") {
    return { selected: [], catalog: [] };
  }
  const day = asOfDate(asOfYmd);
  const [catalogRows, links, splits] = await Promise.all([
    db.mealAllowanceRate.findMany({
      where: { type: "an_tieu_chuan" },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    db.unitSelectedMealRate.findMany({
      where: { unitId, mealAllowanceRate: { type: "an_tieu_chuan" } },
      include: { mealAllowanceRate: true },
    }),
    db.unitMealPeriodSplit.findMany({
      where: { unitId, validFrom: { lte: day } },
      orderBy: [{ mealAllowanceRateId: "asc" }, { validFrom: "asc" }],
    }),
  ]);
  const catalog = catalogRows.map((row) => {
    const periodAmounts = amountsForRate(row, [], fallbackLevels);
    return {
      id: row.id,
      doiTuong: row.doiTuong,
      mucTienAn: row.mucTienAn,
      sortOrder: row.sortOrder,
      periodAmounts,
      percents: amountsToPercents(row.mucTienAn, periodAmounts),
    };
  });
  const selected = links
    .map((link) => link.mealAllowanceRate)
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.mucTienAn - b.mucTienAn || a.id - b.id)
    .map((rate) => {
      const periodAmounts = amountsForRate(rate, splits, fallbackLevels);
      return {
        id: rate.id,
        doiTuong: rate.doiTuong,
        mucTienAn: rate.mucTienAn,
        periodAmounts,
        percents: amountsToPercents(rate.mucTienAn, periodAmounts),
      };
    });
  return { selected, catalog };
}

function applyMealLevels(settings, panel) {
  if (!panel?.selected?.length) return settings;
  return {
    ...settings,
    levels: levelsFromSelection(panel.selected, settings.levels),
  };
}

async function withUnitMealLevels(db, unitId, settings, asOfYmd) {
  const panel = await loadMealRatePanel(db, unitId, asOfYmd, settings.levels);
  return { settings: applyMealLevels(settings, panel), mealRates: panel };
}

async function writeStandardMealSelection(tx, unitId, mealSelection) {
  const rates = mealSelection?.rates || [];
  if (!rates.length) {
    throw new AppError({
      message: "Chọn ít nhất một mức ăn có sẵn.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const ids = [...new Set(rates.map((row) => Number(row.mealAllowanceRateId)))];
  const found = await tx.mealAllowanceRate.findMany({
    where: { id: { in: ids } },
    select: { id: true, type: true, mucTienAn: true },
  });
  if (found.length !== ids.length || found.some((row) => row.type !== "an_tieu_chuan")) {
    throw new AppError({
      message: "Chỉ được chọn mức ăn tiêu chuẩn đã có trong hệ thống.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const byId = new Map(found.map((row) => [row.id, row]));
  const validFrom = asOfDate(mealSelection.validFrom);
  const existing = await tx.unitSelectedMealRate.findMany({
    where: { unitId },
    include: { mealAllowanceRate: { select: { type: true } } },
  });
  const dropIds = existing
    .filter((row) => row.mealAllowanceRate?.type === "an_tieu_chuan" && !ids.includes(row.mealAllowanceRateId))
    .map((row) => row.mealAllowanceRateId);
  if (dropIds.length) {
    await tx.unitSelectedMealRate.deleteMany({ where: { unitId, mealAllowanceRateId: { in: dropIds } } });
    await tx.unitMealPeriodSplit.deleteMany({ where: { unitId, mealAllowanceRateId: { in: dropIds } } });
  }
  for (const row of rates) {
    const rateId = Number(row.mealAllowanceRateId);
    const percents = assertPercentTotal(row.percents, rateId);
    const muc = byId.get(rateId).mucTienAn;
    const kept = parseAmounts(row.periodAmounts);
    const amounts = kept && kept.sang + kept.trua + kept.chieu === muc
      ? kept
      : percentsToAmounts(muc, percents);
    await tx.unitSelectedMealRate.upsert({
      where: { unitId_mealAllowanceRateId: { unitId, mealAllowanceRateId: rateId } },
      create: { unitId, mealAllowanceRateId: rateId },
      update: {},
    });
    await tx.unitMealPeriodSplit.upsert({
      where: {
        unitId_mealAllowanceRateId_validFrom: { unitId, mealAllowanceRateId: rateId, validFrom },
      },
      create: { unitId, mealAllowanceRateId: rateId, validFrom, periodAmountsJson: amounts },
      update: { periodAmountsJson: amounts },
    });
  }
}

export {
  DEFAULT_PERCENTS,
  alignHeadcount,
  amountsToPercents,
  applyMealLevels,
  loadMealRatePanel,
  percentsToAmounts,
  withUnitMealLevels,
  writeStandardMealSelection,
};
