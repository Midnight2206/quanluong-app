import { computeLineTotalQuantity } from "./kitchen-books-quantity.js";

function mapCommodityBrief(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    measureUnit: row.measureUnit,
  };
}

function decimalToString(v) {
  if (v == null) {
    return null;
  }
  return String(v);
}

function enrichLine(line, headcount) {
  const commodity = line.commodity;
  const totals = computeLineTotalQuantity({
    calcMode: line.calcMode,
    perPersonAmount: line.perPersonAmount != null ? Number(line.perPersonAmount) : null,
    perPersonUnit: line.perPersonUnit,
    peoplePerUnit: line.peoplePerUnit != null ? Number(line.peoplePerUnit) : null,
    headcount,
    commodityMeasureUnit: commodity?.measureUnit,
  });
  return {
    id: line.id,
    commodityId: line.commodityId,
    commodity: mapCommodityBrief(commodity),
    calcMode: line.calcMode,
    perPersonAmount: decimalToString(line.perPersonAmount),
    perPersonUnit: line.perPersonUnit,
    peoplePerUnit: decimalToString(line.peoplePerUnit),
    sortOrder: line.sortOrder,
    headcount,
    totalQuantity: String(totals.totalQuantity),
    totalUnit: totals.totalUnit,
  };
}

function mapCatalogLine(line, headcount = 0) {
  return enrichLine(line, headcount);
}

function mapCatalog(row) {
  return {
    id: row.id,
    unitId: row.unitId,
    name: row.name,
    note: row.note,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: (row.lines || []).map((l) => mapCatalogLine(l)),
  };
}

function mapMenuDish(dish, headcount) {
  return {
    id: dish.id,
    name: dish.name,
    sortOrder: dish.sortOrder,
    sourceCatalogId: dish.sourceCatalogId,
    lines: (dish.lines || []).map((l) => enrichLine(l, headcount)),
  };
}

function mapMenuPeriod(period, headcount) {
  return {
    mealPeriod: period.mealPeriod,
    note: period.note,
    headcount,
    dishes: (period.dishes || []).map((d) => mapMenuDish(d, headcount)),
  };
}

export {
  mapCatalog,
  mapCatalogLine,
  mapMenuDish,
  mapMenuPeriod,
  enrichLine,
  mapCommodityBrief,
};
