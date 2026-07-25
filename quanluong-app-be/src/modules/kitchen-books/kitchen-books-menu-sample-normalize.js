/** Pure normalize + vector text for KitchenMenuSample dishesJson (no Prisma). */

function normalizeCalcMode(v) {
  return String(v || "").trim() === "per_unit_shared" ? "per_unit_shared" : "per_person";
}

function normalizePerPersonUnit(v) {
  return String(v || "").trim() === "ml" ? "ml" : "g";
}

function normalizeLine(line, index) {
  const commodityId = Number(line?.commodityId);
  if (!Number.isInteger(commodityId) || commodityId <= 0) {
    throw new Error(`Dòng LTTP ${index + 1}: thiếu commodityId hợp lệ`);
  }

  const calcMode = normalizeCalcMode(line?.calcMode);
  const sortOrder = line?.sortOrder != null ? Number(line.sortOrder) : index;
  const out = { commodityId, calcMode, sortOrder: Number.isFinite(sortOrder) ? sortOrder : index };

  if (calcMode === "per_person") {
    const amount = Number(line?.perPersonAmount);
    const unit = line?.perPersonUnit;
    if (!Number.isFinite(amount) || amount <= 0 || unit == null || String(unit).trim() === "") {
      throw new Error("per_person cần perPersonAmount và perPersonUnit");
    }
    out.perPersonAmount = amount;
    out.perPersonUnit = normalizePerPersonUnit(unit);
    out.peoplePerUnit = null;
  } else {
    const people = Number(line?.peoplePerUnit);
    if (!Number.isFinite(people) || people <= 0) {
      throw new Error("per_unit_shared cần peoplePerUnit");
    }
    out.peoplePerUnit = people;
    out.perPersonAmount = null;
    out.perPersonUnit = null;
  }

  return out;
}

/**
 * @param {unknown} dishes
 * @returns {{ name: string, sortOrder: number, lines: object[] }[]}
 */
function normalizeSampleDishes(dishes) {
  if (!Array.isArray(dishes) || dishes.length === 0) {
    throw new Error("Cần ít nhất một món");
  }

  return dishes.map((dish, di) => {
    const name = String(dish?.name ?? "").trim();
    if (!name) {
      throw new Error(`Món ${di + 1}: thiếu tên món`);
    }

    const rawLines = dish?.lines;
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error(`Món «${name}»: cần ít nhất một dòng LTTP`);
    }

    const sortOrder = dish?.sortOrder != null ? Number(dish.sortOrder) : di;
    return {
      name,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : di,
      lines: rawLines.map((line, li) => normalizeLine(line, li)),
    };
  });
}

function formatLineShort(line) {
  const label =
    String(line?.commodityName ?? "").trim() ||
    (line?.commodityId != null ? `#${line.commodityId}` : "?");
  if (line?.calcMode === "per_unit_shared") {
    return `${label} (${line.peoplePerUnit ?? "?"} nguoi/DVT)`;
  }
  const amount = line?.perPersonAmount ?? "?";
  const unit = line?.perPersonUnit || "g";
  return `${label} (${amount} ${unit}/nguoi)`;
}

/**
 * @param {{ mealPeriod: string, mucTienAn: number|string, dishes: object[] }} sample
 */
function formatSampleTextForVector(sample) {
  const mealPeriod = String(sample?.mealPeriod ?? "").trim();
  const mucTienAn = sample?.mucTienAn != null ? Number(sample.mucTienAn) : "?";
  const lines = [`Buoi ${mealPeriod} | mucTienAn ${mucTienAn}`];
  for (const dish of sample?.dishes || []) {
    const ingredients = (dish.lines || []).map(formatLineShort).join("; ");
    lines.push(`- ${dish.name}: ${ingredients || "(khong LTTP)"}`);
  }
  return lines.join("\n");
}

/**
 * @param {{ sampleId: number, unitId: number, mealPeriod: string, mealAllowanceRateId: number, mucTienAn: number|string, dishes: object[] }} input
 */
function buildSampleVectorPayload(input) {
  const text = formatSampleTextForVector({
    mealPeriod: input.mealPeriod,
    mucTienAn: input.mucTienAn,
    dishes: input.dishes,
  });
  return {
    sampleId: Number(input.sampleId),
    unitId: Number(input.unitId),
    mealPeriod: input.mealPeriod,
    mealAllowanceRateId: Number(input.mealAllowanceRateId),
    mucTienAn: input.mucTienAn != null ? Number(input.mucTienAn) : null,
    text,
  };
}

export {
  normalizeSampleDishes,
  formatSampleTextForVector,
  buildSampleVectorPayload,
};
