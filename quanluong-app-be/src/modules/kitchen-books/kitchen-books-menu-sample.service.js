import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenWriteUnit,
} from "./kitchen-books-scope.helpers.js";
import { validateLinePayload } from "./kitchen-books-catalog.service.js";
import { getMenuDay, putMenuPeriod } from "./kitchen-books-menu.service.js";
import { MEAL_PERIODS } from "./kitchen-books.constants.js";
import { assertStandardMealRateForUnit } from "../meal-roster/meal-roster.service.js";
import { normalizeSampleDishes, buildSampleVectorPayload } from "./kitchen-books-menu-sample-normalize.js";
import { scheduleMenuSampleVectorUpsert } from "./kitchen-books-menu-ai-vector.js";

const SAMPLE_INCLUDE = {
  mealAllowanceRate: {
    select: { mucTienAn: true, doiTuong: true },
  },
};

function notFound() {
  return new AppError({
    message: "Không tìm thấy mẫu thực đơn",
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
  });
}

function assertMealPeriod(mealPeriod) {
  if (!MEAL_PERIODS.includes(mealPeriod)) {
    throw new AppError({
      message: "Buổi ăn không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function validateSampleDishesAgainstScope(dishes, storageUnitId) {
  const normalized = normalizeSampleDishes(dishes);
  for (const dish of normalized) {
    for (const line of dish.lines) {
      await validateLinePayload(line, storageUnitId);
    }
  }
  return normalized;
}

function serializeSample(row) {
  return {
    id: row.id,
    unitId: row.unitId,
    mealPeriod: row.mealPeriod,
    mealAllowanceRateId: row.mealAllowanceRateId,
    mucTienAn: row.mealAllowanceRate?.mucTienAn ?? null,
    doiTuong: row.mealAllowanceRate?.doiTuong ?? null,
    dishes: row.dishesJson,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function dishesJsonToPutMenuDishes(dishesJson) {
  return (Array.isArray(dishesJson) ? dishesJson : []).map((dish, index) => ({
    name: dish.name,
    sortOrder: dish.sortOrder ?? index,
    lines: (Array.isArray(dish.lines) ? dish.lines : []).map((line, lineIndex) => ({
      commodityId: line.commodityId,
      calcMode: line.calcMode,
      perPersonAmount: line.perPersonAmount,
      perPersonUnit: line.perPersonUnit,
      peoplePerUnit: line.peoplePerUnit,
      sortOrder: line.sortOrder ?? lineIndex,
    })),
  }));
}

function periodHasDishes(menuDayPeriods, mealPeriod) {
  return Array.isArray(menuDayPeriods?.[mealPeriod]?.dishes) && menuDayPeriods[mealPeriod].dishes.length > 0;
}

async function getSampleOrThrow(id, unitId, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  const row = await prisma.kitchenMenuSample.findFirst({
    where: { id, unitId: dataScope.storageUnitId },
    include: SAMPLE_INCLUDE,
  });
  if (!row) {
    throw notFound();
  }
  return row;
}

function scheduleVector(row) {
  scheduleMenuSampleVectorUpsert(
    buildSampleVectorPayload({
      sampleId: row.id,
      unitId: row.unitId,
      mealPeriod: row.mealPeriod,
      mealAllowanceRateId: row.mealAllowanceRateId,
      mucTienAn: row.mealAllowanceRate?.mucTienAn ?? null,
      dishes: row.dishesJson,
    }),
  );
}

async function listMenuSamples({ unitId, mealPeriod, rateId }, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  if (mealPeriod != null) {
    assertMealPeriod(mealPeriod);
  }
  const rows = await prisma.kitchenMenuSample.findMany({
    where: {
      unitId: dataScope.storageUnitId,
      ...(mealPeriod != null ? { mealPeriod } : {}),
      ...(rateId != null ? { mealAllowanceRateId: rateId } : {}),
    },
    include: SAMPLE_INCLUDE,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(serializeSample);
}

async function createMenuSample(payload, userId, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(payload.unitId, dataScope);
  assertKitchenWriteUnit(payload.unitId, scope, effectiveUnitIds);
  assertMealPeriod(payload.mealPeriod);
  const storageUnitId = dataScope.storageUnitId;
  await assertStandardMealRateForUnit(storageUnitId, payload.mealAllowanceRateId);
  const dishesJson = await validateSampleDishesAgainstScope(payload.dishes, storageUnitId);
  const row = await prisma.kitchenMenuSample.create({
    data: {
      unitId: storageUnitId,
      mealPeriod: payload.mealPeriod,
      mealAllowanceRateId: payload.mealAllowanceRateId,
      dishesJson,
      createdById: userId,
    },
    include: SAMPLE_INCLUDE,
  });
  scheduleVector(row);
  return serializeSample(row);
}

async function updateMenuSample(id, payload, userId, scope, effectiveUnitIds, dataScope) {
  const existing = await getSampleOrThrow(id, payload.unitId, scope, effectiveUnitIds, dataScope);
  const storageUnitId = dataScope.storageUnitId;
  const mealPeriod = payload.mealPeriod ?? existing.mealPeriod;
  const mealAllowanceRateId = payload.mealAllowanceRateId ?? existing.mealAllowanceRateId;
  assertMealPeriod(mealPeriod);
  await assertStandardMealRateForUnit(storageUnitId, mealAllowanceRateId);
  const dishesJson =
    payload.dishes != null
      ? await validateSampleDishesAgainstScope(payload.dishes, storageUnitId)
      : existing.dishesJson;
  const row = await prisma.kitchenMenuSample.update({
    where: { id: existing.id },
    data: { mealPeriod, mealAllowanceRateId, dishesJson },
    include: SAMPLE_INCLUDE,
  });
  scheduleVector(row);
  return serializeSample(row);
}

async function deleteMenuSample(id, unitId, scope, effectiveUnitIds, dataScope) {
  const sample = await getSampleOrThrow(id, unitId, scope, effectiveUnitIds, dataScope);
  await prisma.kitchenMenuSample.delete({ where: { id: sample.id } });
  return { id: sample.id };
}

async function applyMenuSample(id, body, scope, effectiveUnitIds, dataScope) {
  const unitId = body.unitId ?? dataScope.logicalUnitId;
  const sample = await getSampleOrThrow(id, unitId, scope, effectiveUnitIds, dataScope);
  const menuPreview = await getMenuDay(
    { unitId, date: body.date },
    scope,
    effectiveUnitIds,
    dataScope,
  );
  const willOverwrite = periodHasDishes(menuPreview.periods, sample.mealPeriod);
  if (willOverwrite && !body.confirmOverwrite) {
    return { applied: false, willOverwrite: true };
  }
  const menu = await putMenuPeriod(
    {
      unitId,
      date: body.date,
      mealPeriod: sample.mealPeriod,
      dishes: dishesJsonToPutMenuDishes(sample.dishesJson),
    },
    scope,
    effectiveUnitIds,
    dataScope,
  );
  return { applied: true, willOverwrite, menu };
}

export {
  applyMenuSample,
  createMenuSample,
  deleteMenuSample,
  dishesJsonToPutMenuDishes,
  listMenuSamples,
  periodHasDishes,
  updateMenuSample,
};
