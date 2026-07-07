import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { menuDateToYearMonthDay } from "./kitchen-books-scope.helpers.js";

const DEFAULT_EXTRA_SPLIT_PERIODS = ["sang", "trua", "chieu"];

function parsePeriodsFromJson(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_EXTRA_SPLIT_PERIODS];
  }
  const out = [];
  for (const p of raw) {
    if (p === "sang" || p === "trua" || p === "chieu") {
      out.push(p);
    }
  }
  const sorted = [...new Set(out)].sort((a, b) => {
    const order = { sang: 0, trua: 1, chieu: 2 };
    return order[a] - order[b];
  });
  return sorted.length > 0 ? sorted : [...DEFAULT_EXTRA_SPLIT_PERIODS];
}

async function loadMealRosterMarksForDay(unitId, menuDate) {
  const { yearMonth, dayOfMonth } = menuDateToYearMonthDay(menuDate);
  const entryWhere = { unitId, yearMonth };
  const [marks, extraMarks, splitRows] = await Promise.all([
    prisma.mealRosterDayMark.findMany({
      where: { mealRosterEntry: entryWhere },
      select: {
        mealRosterEntryId: true,
        dayOfMonth: true,
        mealPeriod: true,
        mealAllowanceRateId: true,
      },
    }),
    prisma.mealRosterDayExtraMark.findMany({
      where: { mealRosterEntry: entryWhere },
      select: {
        mealRosterEntryId: true,
        dayOfMonth: true,
        mealAllowanceRateId: true,
      },
    }),
    prisma.mealRosterDayExtraSplit.findMany({
      where: { unitId, yearMonth },
      select: { dayOfMonth: true, periodsJson: true },
    }),
  ]);
  const extraSplits = splitRows.map((s) => ({
    dayOfMonth: s.dayOfMonth,
    periods: parsePeriodsFromJson(s.periodsJson),
  }));
  return { marks, extraMarks, extraSplits, dayOfMonth };
}

function countHeadcountForPeriod({ marks, extraMarks, extraSplits, dayOfMonth, mealPeriod }) {
  const standardIds = new Set();
  for (const m of marks) {
    if (
      m.dayOfMonth === dayOfMonth &&
      m.mealPeriod === mealPeriod &&
      m.mealAllowanceRateId != null
    ) {
      standardIds.add(m.mealRosterEntryId);
    }
  }
  const splitForDay = extraSplits.find((s) => s.dayOfMonth === dayOfMonth);
  const periodsForDay = splitForDay?.periods ?? DEFAULT_EXTRA_SPLIT_PERIODS;
  const extraCount = extraMarks.filter(
    (e) => e.dayOfMonth === dayOfMonth && e.mealAllowanceRateId != null,
  ).length;
  const extraForPeriod = periodsForDay.includes(mealPeriod) ? extraCount : 0;
  return standardIds.size + extraForPeriod;
}

async function getHeadcountForPeriod({ unitId, menuDate, mealPeriod }) {
  const data = await loadMealRosterMarksForDay(unitId, menuDate);
  return countHeadcountForPeriod({
    ...data,
    mealPeriod,
  });
}

async function getHeadcountsForDay(unitId, menuDate) {
  const data = await loadMealRosterMarksForDay(unitId, menuDate);
  return {
    sang: countHeadcountForPeriod({ ...data, mealPeriod: "sang" }),
    trua: countHeadcountForPeriod({ ...data, mealPeriod: "trua" }),
    chieu: countHeadcountForPeriod({ ...data, mealPeriod: "chieu" }),
  };
}

export {
  getHeadcountForPeriod,
  getHeadcountsForDay,
  loadMealRosterMarksForDay,
  countHeadcountForPeriod,
};
