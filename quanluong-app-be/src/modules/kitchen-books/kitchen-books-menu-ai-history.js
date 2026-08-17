/** Pure history sampling + prompt formatters (no Prisma). */

const MEAL_ORDER = ["sang", "trua", "chieu"];
const MEAL_LABEL = { sang: "Sang", trua: "Trua", chieu: "Chieu" };

function utcDay(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.getUTCDay();
}

function utcTime(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.getTime();
}

/**
 * Prefer same weekday as targetDate, then fill with most recent remaining.
 * @param {{ id: number, menuDate: Date }[]} days
 * @param {Date} targetDate
 * @param {number} [limit=45]
 * @returns {number[]}
 */
function selectHistoryDayIds(days, targetDate, limit = 45) {
  const n = Math.max(0, Number(limit) || 0);
  if (!Array.isArray(days) || n === 0) {
    return [];
  }
  const weekday = utcDay(targetDate);
  const sorted = [...days].sort((a, b) => utcTime(b.menuDate) - utcTime(a.menuDate));
  const same = [];
  const other = [];
  for (const d of sorted) {
    if (utcDay(d.menuDate) === weekday) {
      same.push(d);
    } else {
      other.push(d);
    }
  }
  const picked = [...same, ...other].slice(0, n);
  return picked.map((d) => Number(d.id));
}

function formatLineShort(line) {
  const name = line.commodityName || "?";
  if (line.calcMode === "per_unit_shared") {
    return `${name} (${line.peoplePerUnit ?? "?"} nguoi/DVT)`;
  }
  const amount = line.perPersonAmount ?? "?";
  const unit = line.perPersonUnit || "g";
  return `${name} (${amount} ${unit}/nguoi)`;
}

/**
 * @param {Array<{ menuDate: string, periods: Record<string, { dishes: Array<{ name: string, lines: any[] }> }> }>} days
 */
function formatMenuHistoryForPrompt(days) {
  if (!Array.isArray(days) || days.length === 0) {
    return "(khong co lich su)";
  }
  const blocks = [];
  for (const day of days) {
    const lines = [`Ngay ${day.menuDate}:`];
    for (const meal of MEAL_ORDER) {
      const period = day.periods?.[meal];
      if (!period?.dishes?.length) {
        continue;
      }
      lines.push(`  ${MEAL_LABEL[meal] || meal}:`);
      for (const dish of period.dishes) {
        const ingredients = (dish.lines || []).map(formatLineShort).join("; ");
        lines.push(`    - ${dish.name}: ${ingredients || "(khong LTTP)"}`);
      }
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

function formatLocalCatalogForPrompt(commodities, catalogDishes) {
  const cLines = (commodities || []).map((c) => {
    const code = c.code ? ` [${c.code}]` : "";
    const unit = c.measureUnit ? ` (${c.measureUnit})` : "";
    return `- ${c.name}${code}${unit}`;
  });
  const dLines = (catalogDishes || []).map((d) => {
    const ingredients = (d.lines || [])
      .map((l) => l.commodityName || l.commodity?.name || "?")
      .join(", ");
    return `- ${d.name}: ${ingredients || "(khong LTTP)"}`;
  });
  return [
    "LTTP don vi hien tai:",
    cLines.length ? cLines.join("\n") : "(trong)",
    "",
    "Danh muc mon don vi:",
    dLines.length ? dLines.join("\n") : "(trong)",
  ].join("\n");
}

export {
  selectHistoryDayIds,
  formatMenuHistoryForPrompt,
  formatLocalCatalogForPrompt,
};
