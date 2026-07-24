/** Pure enrichment: menu day + market prices → line/meal/day amounts + commodity totals. */

function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return 0;
  }
  return Math.round(x * 100) / 100;
}

function qtyNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {object} menuDay — kết quả `getMenuDay`
 * @param {Map<number, number|null>|Record<number, number|null>} priceByCommodityId — unitPrice thị trường
 * @param {{ appliedPriceTableId?: number|null, appliedEffectiveDate?: string|null }} [meta]
 */
function enrichMenuDayDetail(menuDay, priceByCommodityId, meta = {}) {
  const priceOf = (commodityId) => {
    if (priceByCommodityId == null) {
      return null;
    }
    const raw =
      typeof priceByCommodityId.get === "function"
        ? priceByCommodityId.get(Number(commodityId))
        : priceByCommodityId[commodityId] ?? priceByCommodityId[Number(commodityId)];
    if (raw == null) {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const periods = {};
  let dayAmount = 0;
  let dayMissing = 0;
  /** @type {Map<number, { commodityId: number, name: string, measureUnit: string|null, totalQuantity: number, unitPrice: number|null }>} */
  const agg = new Map();

  for (const mealPeriod of Object.keys(menuDay.periods || {})) {
    const period = menuDay.periods[mealPeriod];
    let mealAmount = 0;
    let missingPriceCount = 0;
    const dishes = (period.dishes || []).map((dish) => {
      const lines = (dish.lines || []).map((line) => {
        const unitPrice = priceOf(line.commodityId);
        const qty = qtyNumber(line.totalQuantity);
        let lineAmount = null;
        if (unitPrice == null) {
          missingPriceCount += 1;
          dayMissing += 1;
        } else {
          lineAmount = roundMoney2(qty * unitPrice);
          mealAmount = roundMoney2(mealAmount + lineAmount);
        }

        const cid = Number(line.commodityId);
        if (Number.isInteger(cid) && cid > 0) {
          const prev = agg.get(cid);
          const name = line.commodity?.name ?? prev?.name ?? `#${cid}`;
          const measureUnit = line.totalUnit ?? line.commodity?.measureUnit ?? prev?.measureUnit ?? null;
          if (prev) {
            prev.totalQuantity = roundMoney2(prev.totalQuantity + qty);
            if (prev.unitPrice == null && unitPrice != null) {
              prev.unitPrice = unitPrice;
            }
          } else {
            agg.set(cid, {
              commodityId: cid,
              name,
              measureUnit,
              totalQuantity: qty,
              unitPrice,
            });
          }
        }

        return {
          ...line,
          unitPrice,
          lineAmount,
        };
      });
      return { ...dish, lines };
    });

    dayAmount = roundMoney2(dayAmount + mealAmount);
    periods[mealPeriod] = {
      ...period,
      dishes,
      mealAmount,
      missingPriceCount,
    };
  }

  const commodityTotals = [...agg.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "vi"))
    .map((row) => ({
      commodityId: row.commodityId,
      name: row.name,
      measureUnit: row.measureUnit,
      totalQuantity: String(row.totalQuantity),
      unitPrice: row.unitPrice,
      amount: row.unitPrice == null ? null : roundMoney2(row.totalQuantity * row.unitPrice),
    }));

  return {
    ...menuDay,
    periods,
    dayAmount,
    missingPriceCount: dayMissing,
    appliedPriceTableId: meta.appliedPriceTableId ?? null,
    appliedEffectiveDate: meta.appliedEffectiveDate ?? null,
    commodityTotals,
  };
}

export { enrichMenuDayDetail, roundMoney2 };
