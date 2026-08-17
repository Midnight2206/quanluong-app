import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { config } from "../../config/config.js";
import {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenWriteUnit,
  parseDateOnly,
} from "./kitchen-books-scope.helpers.js";
import { MEAL_PERIODS } from "./kitchen-books.constants.js";
import { getMenuDay, putMenuPeriod } from "./kitchen-books-menu.service.js";
import {
  formatLocalCatalogForPrompt,
  formatMenuHistoryForPrompt,
  selectHistoryDayIds,
} from "./kitchen-books-menu-ai-history.js";
import { assertMenuAiConfigured, completeMenuJson } from "./kitchen-books-menu-ai-llm.js";
import { filterMappedPeriods, mapLlmPeriodsToLocal } from "./kitchen-books-menu-ai-enrich.js";

function dateOnlyIso(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

function buildPrompt({ historyText, localText, date }) {
  const system = [
    "Ban la tro ly bep an quan luong Viet Nam.",
    "Chi tra ve JSON object dung schema: periods.sang|trua|chieu, moi buoi co dishes[].",
    "Moi dish: { name, lines: [{ commodityName, calcMode: per_person|per_unit_shared, perPersonAmount, perPersonUnit: g|ml, peoplePerUnit }] }.",
    "Uu tien ten LTTP va mon co trong danh muc don vi hien tai.",
    "Hoc phong cach tu lich su thuc don toan he thong.",
  ].join(" ");

  const user = [
    `Lap thuc don cho ngay ${date} (3 buoi sang/trua/chieu).`,
    "",
    localText,
    "",
    "Lich su mau (toan he thong):",
    historyText,
  ].join("\n");

  return { system, user };
}

async function loadHistorySamples(targetDate, limit = 45) {
  const recent = await prisma.kitchenMenuDay.findMany({
    orderBy: { menuDate: "desc" },
    take: 80,
    select: { id: true, menuDate: true },
  });
  const ids = selectHistoryDayIds(recent, targetDate, limit);
  if (!ids.length) {
    return { historyText: "(khong co lich su)", historySampleCount: 0 };
  }
  const rows = await prisma.kitchenMenuDay.findMany({
    where: { id: { in: ids } },
    include: {
      periods: {
        include: {
          dishes: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            include: {
              lines: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                include: { commodity: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  const formatted = ordered.map((day) => {
    const periods = {};
    for (const p of day.periods || []) {
      periods[p.mealPeriod] = {
        dishes: (p.dishes || []).map((d) => ({
          name: d.name,
          lines: (d.lines || []).map((l) => ({
            commodityName: l.commodity?.name,
            calcMode: l.calcMode,
            perPersonAmount: l.perPersonAmount != null ? Number(l.perPersonAmount) : null,
            perPersonUnit: l.perPersonUnit,
            peoplePerUnit: l.peoplePerUnit != null ? Number(l.peoplePerUnit) : null,
          })),
        })),
      };
    }
    return { menuDate: dateOnlyIso(day.menuDate), periods };
  });
  return {
    historyText: formatMenuHistoryForPrompt(formatted),
    historySampleCount: formatted.length,
  };
}

async function loadLocalCatalog(storageUnitId) {
  const commodities = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, name: true, code: true, measureUnit: true },
  });
  const catalogs = await prisma.kitchenDishCatalog.findMany({
    where: { unitId: storageUnitId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: 80,
    include: {
      lines: {
        include: { commodity: { select: { name: true } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });
  const catalogDishes = catalogs.map((c) => ({
    name: c.name,
    lines: (c.lines || []).map((l) => ({ commodityName: l.commodity?.name })),
  }));
  return {
    commodities,
    localText: formatLocalCatalogForPrompt(commodities, catalogDishes),
  };
}

async function suggestMenuDay(
  { unitId, date },
  scope,
  effectiveUnitIds,
  dataScope,
  opts = {},
) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  assertMenuAiConfigured(opts.configOverride ?? config.menuAi);

  const menuDate = parseDateOnly(date);
  const storageUnitId = dataScope.storageUnitId;
  const { historyText, historySampleCount } = await loadHistorySamples(menuDate);
  const { commodities, localText } = await loadLocalCatalog(storageUnitId);
  const prompt = buildPrompt({ historyText, localText, date: dateOnlyIso(menuDate) });

  const complete = opts.completeMenuJson || completeMenuJson;
  const llmJson = await complete(prompt, {
    configOverride: opts.configOverride ?? config.menuAi,
    fetchImpl: opts.fetchImpl,
  });

  const { periods, warnings } = mapLlmPeriodsToLocal(llmJson.periods || llmJson, commodities);
  if (historySampleCount < 5) {
    warnings.unshift("Ít dữ liệu lịch sử toàn hệ thống — gợi ý có thể kém ổn định.");
  }

  return {
    periods,
    warnings,
    meta: { historySampleCount },
  };
}

async function applyMenuDayAi({ unitId, date, periods }, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);

  if (!periods || typeof periods !== "object") {
    throw new AppError({
      message: "periods không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const { periods: filtered, droppedLineCount } = filterMappedPeriods(periods);

  for (const mealPeriod of MEAL_PERIODS) {
    await putMenuPeriod(
      {
        unitId,
        date,
        mealPeriod,
        note: null,
        dishes: filtered[mealPeriod]?.dishes || [],
      },
      scope,
      effectiveUnitIds,
      dataScope,
    );
  }

  const menu = await getMenuDay({ unitId, date }, scope, effectiveUnitIds, dataScope);
  return { menu, droppedLineCount };
}

export {
  suggestMenuDay,
  applyMenuDayAi,
  filterMappedPeriods,
  mapLlmPeriodsToLocal,
};
