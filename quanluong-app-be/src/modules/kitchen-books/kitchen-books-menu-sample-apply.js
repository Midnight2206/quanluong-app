/** Pure helpers for applying a menu sample to a daily menu. */

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

export { dishesJsonToPutMenuDishes, periodHasDishes };
