import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenRowStorage,
  assertKitchenWriteUnit,
  parseDateOnly,
} from "./kitchen-books-scope.helpers.js";
import { getHeadcountsForDay } from "./kitchen-books-headcount.service.js";
import { mapMenuDish, mapMenuPeriod } from "./kitchen-books.mapper.js";
import { MEAL_PERIODS } from "./kitchen-books.constants.js";
import {
  CATALOG_INCLUDE,
  getCatalogById,
  lineCreateData,
  validateLinePayload,
} from "./kitchen-books-catalog.service.js";

const DISH_INCLUDE = {
  lines: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      commodity: {
        select: { id: true, code: true, name: true, measureUnit: true, unitId: true },
      },
    },
  },
};

const PERIOD_INCLUDE = {
  dishes: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: DISH_INCLUDE,
  },
};

const DAY_INCLUDE = {
  periods: {
    include: PERIOD_INCLUDE,
  },
};

async function ensureMenuDay(storageUnitId, menuDate) {
  const date = parseDateOnly(menuDate);
  let day = await prisma.kitchenMenuDay.findUnique({
    where: { unitId_menuDate: { unitId: storageUnitId, menuDate: date } },
    include: DAY_INCLUDE,
  });
  if (!day) {
    day = await prisma.kitchenMenuDay.create({
      data: {
        unitId: storageUnitId,
        menuDate: date,
        periods: {
          create: MEAL_PERIODS.map((mealPeriod) => ({ mealPeriod })),
        },
      },
      include: DAY_INCLUDE,
    });
  } else if (day.periods.length < MEAL_PERIODS.length) {
    const existing = new Set(day.periods.map((p) => p.mealPeriod));
    const missing = MEAL_PERIODS.filter((p) => !existing.has(p));
    if (missing.length) {
      await prisma.kitchenMenuPeriod.createMany({
        data: missing.map((mealPeriod) => ({ dayId: day.id, mealPeriod })),
      });
      day = await prisma.kitchenMenuDay.findUnique({
        where: { id: day.id },
        include: DAY_INCLUDE,
      });
    }
  }
  return day;
}

async function getMenuDay({ unitId, date }, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const menuDate = parseDateOnly(date);
  const headcounts = await getHeadcountsForDay(unitId, menuDate);

  let day = await prisma.kitchenMenuDay.findUnique({
    where: { unitId_menuDate: { unitId: storageUnitId, menuDate } },
    include: DAY_INCLUDE,
  });
  if (!day) {
    day = {
      unitId: storageUnitId,
      menuDate,
      periods: MEAL_PERIODS.map((mealPeriod) => ({
        mealPeriod,
        note: null,
        dishes: [],
      })),
    };
  }

  const periodMap = new Map(day.periods.map((p) => [p.mealPeriod, p]));
  const periods = {};
  for (const mealPeriod of MEAL_PERIODS) {
    const period = periodMap.get(mealPeriod) ?? { mealPeriod, note: null, dishes: [] };
    const headcount = headcounts[mealPeriod] ?? 0;
    periods[mealPeriod] = mapMenuPeriod(period, headcount);
  }

  return {
    unitId,
    storageUnitId,
    menuDate: date,
    periods,
    headcounts,
  };
}

async function validateDishLines(lines, storageUnitId) {
  if (!Array.isArray(lines)) {
    throw new AppError({
      message: "lines phải là mảng",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  for (const line of lines) {
    await validateLinePayload(line, storageUnitId);
  }
}

async function putMenuPeriod(payload, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(payload.unitId, dataScope);
  assertKitchenWriteUnit(payload.unitId, scope, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const menuDate = parseDateOnly(payload.date);
  const mealPeriod = payload.mealPeriod;
  if (!MEAL_PERIODS.includes(mealPeriod)) {
    throw new AppError({
      message: "Buổi ăn không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const dishes = payload.dishes ?? [];
  for (const dish of dishes) {
    const name = String(dish.name ?? "").trim();
    if (!name) {
      throw new AppError({
        message: "Tên món là bắt buộc",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    await validateDishLines(dish.lines ?? [], storageUnitId);
  }

  const day = await ensureMenuDay(storageUnitId, menuDate);
  let period = day.periods.find((p) => p.mealPeriod === mealPeriod);
  if (!period) {
    period = await prisma.kitchenMenuPeriod.create({
      data: { dayId: day.id, mealPeriod },
      include: PERIOD_INCLUDE,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.kitchenMenuPeriod.update({
      where: { id: period.id },
      data: { note: payload.note != null ? String(payload.note).trim() || null : null },
    });
    await tx.kitchenMenuDish.deleteMany({ where: { periodId: period.id } });
    for (let i = 0; i < dishes.length; i++) {
      const dish = dishes[i];
      await tx.kitchenMenuDish.create({
        data: {
          periodId: period.id,
          name: String(dish.name).trim(),
          sortOrder: dish.sortOrder ?? i,
          sourceCatalogId: dish.sourceCatalogId ?? null,
          lines: {
            create: (dish.lines ?? []).map((line, li) => lineCreateData(line, li)),
          },
        },
      });
    }
  });

  return getMenuDay({ unitId: payload.unitId, date: payload.date }, scope, effectiveUnitIds, dataScope);
}

async function importCatalogToPeriod(payload, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(payload.unitId, dataScope);
  assertKitchenWriteUnit(payload.unitId, scope, effectiveUnitIds);
  const catalog = await getCatalogById(
    payload.catalogId,
    payload.unitId,
    scope,
    effectiveUnitIds,
    dataScope,
  );
  const storageUnitId = dataScope.storageUnitId;
  assertKitchenRowStorage(catalog.unitId, dataScope);

  const menuDate = parseDateOnly(payload.date);
  const mealPeriod = payload.mealPeriod;
  const day = await ensureMenuDay(storageUnitId, menuDate);
  let period = day.periods.find((p) => p.mealPeriod === mealPeriod);
  if (!period) {
    period = await prisma.kitchenMenuPeriod.create({
      data: { dayId: day.id, mealPeriod },
    });
  }

  const maxSort = await prisma.kitchenMenuDish.aggregate({
    where: { periodId: period.id },
    _max: { sortOrder: true },
  });
  let nextSort = (maxSort._max.sortOrder ?? -1) + 1;

  const catalogRow = await prisma.kitchenDishCatalog.findFirst({
    where: { id: payload.catalogId },
    include: CATALOG_INCLUDE,
  });

  await prisma.kitchenMenuDish.create({
    data: {
      periodId: period.id,
      name: catalogRow.name,
      sortOrder: nextSort,
      sourceCatalogId: catalogRow.id,
      lines: {
        create: catalogRow.lines.map((line, index) => ({
          commodityId: line.commodityId,
          calcMode: line.calcMode,
          perPersonAmount: line.perPersonAmount,
          perPersonUnit: line.perPersonUnit,
          peoplePerUnit: line.peoplePerUnit,
          sortOrder: line.sortOrder ?? index,
        })),
      },
    },
  });

  return getMenuDay(
    { unitId: payload.unitId, date: payload.date },
    scope,
    effectiveUnitIds,
    dataScope,
  );
}

async function deleteMenuDish(dishId, unitId, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  const dish = await prisma.kitchenMenuDish.findFirst({
    where: { id: dishId },
    include: {
      period: {
        include: { day: true },
      },
    },
  });
  if (!dish) {
    throw new AppError({
      message: "Không tìm thấy món trên thực đơn",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertKitchenRowStorage(dish.period.day.unitId, dataScope);
  await prisma.kitchenMenuDish.delete({ where: { id: dishId } });
  return { id: dishId };
}

async function listMenuMonthMarkers({ unitId, yearMonth }, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const m = String(yearMonth).match(/^(\d{4})-(\d{2})$/);
  if (!m) {
    throw new AppError({
      message: "yearMonth dạng YYYY-MM",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const end = new Date(Date.UTC(y, mo, 0));

  const days = await prisma.kitchenMenuDay.findMany({
    where: {
      unitId: storageUnitId,
      menuDate: { gte: start, lte: end },
      periods: {
        some: {
          dishes: { some: {} },
        },
      },
    },
    select: { menuDate: true },
    orderBy: { menuDate: "asc" },
  });

  return {
    unitId,
    storageUnitId,
    yearMonth,
    daysWithMenu: days.map((d) => d.menuDate.getUTCDate()),
  };
}

export {
  getMenuDay,
  putMenuPeriod,
  importCatalogToPeriod,
  deleteMenuDish,
  listMenuMonthMarkers,
};
