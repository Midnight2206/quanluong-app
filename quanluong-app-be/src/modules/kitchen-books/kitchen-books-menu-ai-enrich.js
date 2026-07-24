import { MEAL_PERIODS } from "./kitchen-books.constants.js";
import { mapCommodityNameToId } from "./kitchen-books-menu-ai-map.js";

function emptyPeriods() {
  return {
    sang: { dishes: [] },
    trua: { dishes: [] },
    chieu: { dishes: [] },
  };
}

function normalizeCalcMode(v) {
  return String(v || "").trim() === "per_unit_shared" ? "per_unit_shared" : "per_person";
}

/**
 * @param {object} llmPeriods
 * @param {{ id: number, name: string, code?: string|null }[]} commodities
 */
function mapLlmPeriodsToLocal(llmPeriods, commodities) {
  const warnings = [];
  const periods = emptyPeriods();
  for (const meal of MEAL_PERIODS) {
    const src = llmPeriods?.[meal] || { dishes: [] };
    const dishes = [];
    for (const dish of src.dishes || []) {
      const name = String(dish?.name ?? "").trim();
      if (!name) {
        continue;
      }
      const lines = [];
      for (const line of dish.lines || []) {
        const commodityName = String(line?.commodityName ?? line?.name ?? "").trim();
        const hit = mapCommodityNameToId(commodityName, commodities);
        const calcMode = normalizeCalcMode(line?.calcMode);
        const mappedLine = {
          commodityId: hit.commodityId,
          commodityName: hit.matchedName || commodityName || null,
          calcMode,
          perPersonAmount:
            calcMode === "per_person" && line?.perPersonAmount != null
              ? Number(line.perPersonAmount)
              : null,
          perPersonUnit: calcMode === "per_person" ? line?.perPersonUnit || "g" : null,
          peoplePerUnit:
            calcMode === "per_unit_shared" && line?.peoplePerUnit != null
              ? Number(line.peoplePerUnit)
              : null,
          mapped: hit.mapped,
        };
        if (!hit.mapped) {
          warnings.push(`Chưa map LTTP «${commodityName || "?"}» (món ${name}, buổi ${meal}).`);
        }
        lines.push(mappedLine);
      }
      dishes.push({ name, lines });
    }
    periods[meal] = { dishes };
  }
  return { periods, warnings };
}

/**
 * Keep only mapped lines with commodityId; drop empty dishes.
 * @returns {{ periods: object, droppedLineCount: number }}
 */
function filterMappedPeriods(inputPeriods) {
  let droppedLineCount = 0;
  const periods = emptyPeriods();
  for (const meal of MEAL_PERIODS) {
    const dishes = [];
    for (const dish of inputPeriods?.[meal]?.dishes || []) {
      const name = String(dish?.name ?? "").trim();
      if (!name) {
        continue;
      }
      const lines = [];
      for (const line of dish.lines || []) {
        const mapped = line?.mapped === true || (line?.commodityId != null && line?.mapped !== false);
        const cid = Number(line?.commodityId);
        if (!mapped || !Number.isInteger(cid) || cid <= 0) {
          droppedLineCount += 1;
          continue;
        }
        lines.push({
          commodityId: cid,
          calcMode: normalizeCalcMode(line.calcMode),
          perPersonAmount: line.perPersonAmount != null ? Number(line.perPersonAmount) : null,
          perPersonUnit: line.perPersonUnit || null,
          peoplePerUnit: line.peoplePerUnit != null ? Number(line.peoplePerUnit) : null,
        });
      }
      if (lines.length) {
        dishes.push({ name, lines });
      }
    }
    periods[meal] = { dishes };
  }
  return { periods, droppedLineCount };
}

export { filterMappedPeriods, mapLlmPeriodsToLocal, normalizeCalcMode };
