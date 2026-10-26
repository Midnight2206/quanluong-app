/**
 * Sổ nhập xuất LTTP — tính một ngày.
 * Tồn, FIFO và công khai tài chính nằm ở đây để thực đơn tuần và tịnh kho gọi lại,
 * không nhân bản công thức.
 */
import {
  add,
  divByNumber,
  min,
  mul,
  roundHalfUpToStep,
  roundUpToStep,
  scaledToString,
  sub,
  toScaled,
} from "./kitchen-ledger-decimal.js";
import { sortLedgerLines } from "./kitchen-ledger-line-order.js";
import { MEALS, mergeLedgerSettings, nameMatchesRule, normalizeName } from "./kitchen-ledger-settings.js";

const EXTRA_KEYS = ["benhXa", "benhNhan", "omTrai", "leTet"];

function classifyItem(name, measureUnit, settings) {
  const n = normalizeName(name);
  const uom = normalizeName(measureUnit);
  if (settings.riceNamePattern && n.includes(normalizeName(settings.riceNamePattern))) return "rice";
  if (n.includes("chất đốt") || uom === "đ") return "fuel";
  if (n.includes("sữa")) return "milk";
  for (const spice of settings.spices) {
    if (nameMatchesRule(n, spice.match)) return "spice";
  }
  return "fresh";
}

function levelRule(settings, level) {
  if (level?.code) {
    const byCode = settings.levels.find((row) => String(row.code) === String(level.code));
    if (byCode) return byCode;
  }
  return settings.levels.find((row) => Number(row.dailyAmount) === Number(level.dailyAmount)) ?? null;
}

function headcountOf(level, meal) {
  return toScaled(level?.[meal] ?? 0);
}

function extrasOf(headcount) {
  const src = headcount?.extras ?? {};
  return Object.fromEntries(EXTRA_KEYS.map((key) => [key, toScaled(src[key] ?? 0)]));
}

function planRations({ settings, headcount }) {
  const s = mergeLedgerSettings(settings);
  const levels = Array.isArray(headcount?.levels) ? headcount.levels : [];
  let servings = 0n;
  let riceGrams = 0n;
  for (const level of levels) {
    const rule = levelRule(s, level);
    for (const meal of MEALS) {
      const hc = headcountOf(level, meal);
      servings = add(servings, mul(toScaled(s.servingWeights[meal]), hc));
      if (rule) riceGrams = add(riceGrams, mul(hc, toScaled(rule.riceGrams[meal])));
    }
  }
  const riceKg = divByNumber(riceGrams, 1000);
  const fuelAmount = mul(servings, toScaled(s.fuelPerServing));
  const extras = extrasOf(headcount);
  let milkQty = 0n;
  if (s.milk.mode !== "purchase") {
    if (s.milk.fromPatientExtra) {
      milkQty = add(milkQty, mul(extras.benhNhan, toScaled(s.milk.boxesPerPerson)));
    }
    const watched = new Set((s.milk.levelDailyAmounts || []).map(Number));
    for (const level of levels) {
      if (!watched.has(Number(level.dailyAmount))) continue;
      const people = MEALS.reduce((best, meal) => {
        const hc = headcountOf(level, meal);
        return hc > best ? hc : best;
      }, 0n);
      milkQty = add(milkQty, mul(people, toScaled(s.milk.boxesPerPerson)));
    }
  }
  const spices = s.spices.map((spice) => {
    const raw = spice.fixedQty != null
      ? toScaled(spice.fixedQty)
      : divByNumber(mul(servings, toScaled(spice.qtyPerUnit)), spice.peoplePerUnit);
    const qty = spice.fixedQty != null ? raw : roundHalfUpToStep(raw, toScaled(spice.roundStep ?? 0.1));
    return { match: spice.match, qty: scaledToString(qty), qtyScaled: qty };
  });
  return {
    servings: scaledToString(servings),
    riceKg: scaledToString(riceKg),
    riceKgScaled: riceKg,
    fuelAmount: scaledToString(fuelAmount),
    fuelAmountScaled: fuelAmount,
    milkQty: scaledToString(milkQty),
    milkQtyScaled: milkQty,
    spices,
  };
}

function computeFinance({
  settings,
  headcount,
  prevSurplus = 0,
  prevShortfall = 0,
  riceSubsidy = 0,
  otherIncome = {},
  sumMealOut = 0,
  sumTotalOut = 0,
}) {
  const s = mergeLedgerSettings(settings);
  const levels = Array.isArray(headcount?.levels) ? headcount.levels : [];
  const levelLines = [];
  let subtotal = 0n;
  for (const level of levels) {
    const rule = levelRule(s, level);
    const meals = MEALS.map((meal) => {
      const hc = headcountOf(level, meal);
      const price = toScaled(rule?.mealPrices?.[meal] ?? 0);
      const amount = mul(hc, price);
      subtotal = add(subtotal, amount);
      return {
        meal,
        headcount: scaledToString(hc),
        price: scaledToString(price),
        amount: scaledToString(amount),
      };
    });
    levelLines.push({
      code: level.code ?? "",
      dailyAmount: level.dailyAmount,
      meals,
    });
  }
  const extras = extrasOf(headcount);
  const extraLines = EXTRA_KEYS.map((key) => {
    const count = extras[key];
    const rate = toScaled(s.extraRates[key] ?? 0);
    const amount = mul(count, rate);
    subtotal = add(subtotal, amount);
    return { key, count: scaledToString(count), rate: scaledToString(rate), amount: scaledToString(amount) };
  });
  const prevSurplusS = toScaled(prevSurplus);
  const prevShortfallS = toScaled(prevShortfall);
  const subsidy = toScaled(riceSubsidy);
  const anThem = toScaled(otherIncome.anThem ?? 0);
  const truyLinh = toScaled(otherIncome.truyLinh ?? 0);
  const thuKhach = toScaled(otherIncome.thuKhach ?? 0);
  const totalIncome = add(add(add(add(add(subtotal, prevSurplusS), subsidy), anThem), truyLinh), thuKhach);
  const spent = s.spentBasis === "meal_out" ? toScaled(sumMealOut) : toScaled(sumTotalOut);
  const totalSpent = add(spent, prevShortfallS);
  const diff = sub(totalIncome, totalSpent);
  const surplus = diff > 0n ? diff : 0n;
  const shortfall = diff < 0n ? -diff : 0n;
  const threshold = toScaled(s.balanceWarnThreshold);
  return {
    spentBasis: s.spentBasis,
    levels: levelLines,
    extras: extraLines,
    subtotal: scaledToString(subtotal),
    prevSurplus: scaledToString(prevSurplusS),
    riceSubsidy: scaledToString(subsidy),
    otherIncome: {
      anThem: scaledToString(anThem),
      truyLinh: scaledToString(truyLinh),
      thuKhach: scaledToString(thuKhach),
    },
    totalIncome: scaledToString(totalIncome),
    spent: scaledToString(spent),
    prevShortfall: scaledToString(prevShortfallS),
    totalSpent: scaledToString(totalSpent),
    surplus: scaledToString(surplus),
    shortfall: scaledToString(shortfall),
    balanceWarn: surplus >= threshold || shortfall >= threshold,
    balanceWarnThreshold: s.balanceWarnThreshold,
  };
}

function emptyLot(seed) {
  return {
    name: seed.name,
    itemKey: normalizeName(seed.name),
    uom: seed.uom,
    unitPrice: seed.unitPrice,
    unitPriceScaled: toScaled(seed.unitPrice),
    commodityId: seed.commodityId ?? null,
    role: seed.role,
    displayDash: Boolean(seed.displayDash),
    receivedDate: seed.receivedDate || "0000-01-01",
    groupOrder: seed.groupOrder,
    groupCode: seed.groupCode || "",
    groupSort: Number.isFinite(seed.groupSort) ? seed.groupSort : null,
    openingQty: 0n,
    inG: 0n,
    inH: 0n,
    inI: 0n,
    inJ: 0n,
    inBalance: 0n,
    mealQty: 0n,
    otherQty: 0n,
  };
}

function lotPriceKey(name, price) {
  return `${normalizeName(name)}|${scaledToString(toScaled(price))}`;
}

function inTotal(lot) {
  return add(add(lot.inG, lot.inH), add(lot.inI, lot.inJ));
}

function addReceipt(lot, source, qty, balance) {
  if (source === "H") lot.inH = add(lot.inH, qty);
  else if (source === "I") lot.inI = add(lot.inI, qty);
  else if (source === "J") lot.inJ = add(lot.inJ, qty);
  else lot.inG = add(lot.inG, qty);
  if (balance) lot.inBalance = add(lot.inBalance, qty);
}

function freshMealQty(lot, policy) {
  const purch = sub(inTotal(lot), lot.inBalance);
  if (policy === "keep") return 0n;
  if (policy === "all") return add(lot.openingQty, purch);
  return purch;
}

function allocateFifo(lots, needed) {
  let left = needed;
  const ordered = [...lots].sort((a, b) => {
    if (a.receivedDate !== b.receivedDate) return a.receivedDate < b.receivedDate ? -1 : 1;
    return a.unitPriceScaled < b.unitPriceScaled ? -1 : a.unitPriceScaled > b.unitPriceScaled ? 1 : 0;
  });
  for (const lot of ordered) {
    if (left <= 0n) break;
    const avail = sub(add(lot.openingQty, inTotal(lot)), add(lot.mealQty, lot.otherQty));
    const take = min(avail > 0n ? avail : 0n, left);
    if (take > 0n) {
      lot.mealQty = add(lot.mealQty, take);
      left = sub(left, take);
    }
  }
  if (left > 0n && ordered.length) {
    const last = ordered[ordered.length - 1];
    last.mealQty = add(last.mealQty, left);
  }
}

function allocateOther(lots, needed) {
  let left = needed;
  const ordered = [...lots].sort((a, b) => (a.receivedDate < b.receivedDate ? -1 : a.receivedDate > b.receivedDate ? 1 : 0));
  for (const lot of ordered) {
    if (left <= 0n) break;
    const avail = sub(add(lot.openingQty, inTotal(lot)), add(lot.mealQty, lot.otherQty));
    const take = min(avail > 0n ? avail : 0n, left);
    if (take > 0n) {
      lot.otherQty = add(lot.otherQty, take);
      left = sub(left, take);
    }
  }
  if (left > 0n && ordered.length) {
    ordered[ordered.length - 1].otherQty = add(ordered[ordered.length - 1].otherQty, left);
  }
}

function spiceRuleFor(name, settings) {
  return settings.spices.find((spice) => nameMatchesRule(name, spice.match)) ?? null;
}

function stepFor(name, role, settings) {
  if (role === "fuel") return toScaled(settings.balanceRound.fuelStep);
  const hit = settings.balanceRound.steps.find((row) => nameMatchesRule(name, row.match));
  return toScaled(hit?.step ?? settings.balanceRound.defaultStep);
}

function money(qty, price) {
  return mul(qty, price);
}

function lineFromLot(lot) {
  const inn = inTotal(lot);
  const openingAmount = money(lot.openingQty, lot.unitPriceScaled);
  const inAmount = money(inn, lot.unitPriceScaled);
  const totalInQty = add(lot.openingQty, inn);
  const mealAmount = money(lot.mealQty, lot.unitPriceScaled);
  const otherAmount = money(lot.otherQty, lot.unitPriceScaled);
  const totalOutQty = add(lot.mealQty, lot.otherQty);
  const totalOutAmount = add(mealAmount, otherAmount);
  const closingQty = sub(totalInQty, totalOutQty);
  const closingAmount = money(closingQty, lot.unitPriceScaled);
  return {
    name: lot.name,
    itemKey: lot.itemKey,
    uom: lot.uom,
    unitPrice: scaledToString(lot.unitPriceScaled),
    commodityId: lot.commodityId,
    role: lot.role,
    displayDash: lot.displayDash,
    receivedDate: lot.receivedDate,
    groupOrder: lot.groupOrder,
    groupCode: lot.groupCode,
    groupSort: lot.groupSort,
    openingQty: scaledToString(lot.openingQty),
    openingAmount: scaledToString(openingAmount),
    inG: scaledToString(lot.inG),
    inH: scaledToString(lot.inH),
    inI: scaledToString(lot.inI),
    inJ: scaledToString(lot.inJ),
    inAmount: scaledToString(inAmount),
    totalInQty: scaledToString(totalInQty),
    totalInAmount: scaledToString(add(openingAmount, inAmount)),
    mealQty: scaledToString(lot.mealQty),
    mealAmount: scaledToString(mealAmount),
    otherQty: scaledToString(lot.otherQty),
    otherAmount: scaledToString(otherAmount),
    totalOutQty: scaledToString(totalOutQty),
    totalOutAmount: scaledToString(totalOutAmount),
    closingQty: scaledToString(closingQty),
    closingAmount: scaledToString(closingAmount),
    negative: closingQty < 0n,
  };
}

function sumField(lines, field) {
  return lines.reduce((acc, line) => add(acc, toScaled(line[field])), 0n);
}

function suggestBalance(lines, settings) {
  const s = mergeLedgerSettings(settings);
  const out = [];
  for (const line of lines) {
    const closing = toScaled(line.closingQty);
    if (closing >= 0n) continue;
    const step = stepFor(line.name, line.role, s);
    const suggest = roundUpToStep(-closing, step);
    out.push({
      name: line.name,
      uom: line.uom,
      unitPrice: line.unitPrice,
      commodityId: line.commodityId,
      role: line.role,
      shortfall: scaledToString(-closing),
      suggestQty: scaledToString(suggest),
      source: "I",
    });
  }
  return out;
}

function splitLedgerPages(lines, options = {}) {
  const singlePageMax = options.singlePageMax ?? 28;
  const pageCapacity = options.pageCapacity ?? 40;
  const minTail = options.minTail ?? 2;
  if (lines.length <= singlePageMax) {
    return [{ lines, carry: null }];
  }
  const pages = [];
  let index = 0;
  while (index < lines.length) {
    let take = Math.min(pageCapacity, lines.length - index);
    const rest = lines.length - index - take;
    if (rest > 0 && rest < minTail) take = lines.length - index - minTail;
    if (take <= 0) take = lines.length - index;
    const slice = lines.slice(index, index + take);
    index += take;
    const carry = index < lines.length
      ? {
        openingAmount: scaledToString(sumField(slice, "openingAmount")),
        inAmount: scaledToString(sumField(slice, "inAmount")),
        totalInAmount: scaledToString(sumField(slice, "totalInAmount")),
        mealAmount: scaledToString(sumField(slice, "mealAmount")),
        otherAmount: scaledToString(sumField(slice, "otherAmount")),
        totalOutAmount: scaledToString(sumField(slice, "totalOutAmount")),
      }
      : null;
    pages.push({ lines: slice, carry });
  }
  return pages;
}

function ensureLot(map, orderRef, seed) {
  const key = lotPriceKey(seed.name, seed.unitPrice);
  const existing = map.get(key);
  if (existing) {
    if (!existing.groupCode && seed.groupCode) {
      existing.groupCode = seed.groupCode;
      existing.groupSort = Number.isFinite(seed.groupSort) ? seed.groupSort : null;
    }
    return existing;
  }
  if (orderRef.byItem[normalizeName(seed.name)] == null) {
    orderRef.byItem[normalizeName(seed.name)] = orderRef.next;
    orderRef.next += 1;
  }
  const lot = emptyLot({ ...seed, groupOrder: orderRef.byItem[normalizeName(seed.name)] });
  map.set(key, lot);
  return lot;
}

function computeLedger(raw) {
  const settings = mergeLedgerSettings(raw.settings);
  const plan = planRations({ settings, headcount: raw.headcount });
  const date = raw.date || "0000-01-01";
  const lots = new Map();
  const orderRef = { next: 0, byItem: {} };
  const policy = new Map();

  for (const opening of raw.openingLots || []) {
    const role = opening.role || classifyItem(opening.name, opening.uom, settings);
    const lot = ensureLot(lots, orderRef, {
      ...opening,
      role,
      displayDash: role === "fuel" || opening.displayDash,
      unitPrice: role === "fuel" ? 1 : opening.unitPrice,
      receivedDate: opening.receivedDate || "0000-01-01",
    });
    lot.openingQty = add(lot.openingQty, toScaled(opening.qty));
    if (opening.receivedDate && opening.receivedDate < lot.receivedDate) {
      lot.receivedDate = opening.receivedDate;
    }
  }

  for (const receipt of raw.receipts || []) {
    const qty = toScaled(receipt.qty);
    if (qty === 0n) continue;
    const role = classifyItem(receipt.name, receipt.uom, settings);
    const lot = ensureLot(lots, orderRef, {
      ...receipt,
      role,
      displayDash: role === "fuel",
      unitPrice: role === "fuel" ? 1 : receipt.unitPrice,
      receivedDate: receipt.receivedDate || date,
    });
    addReceipt(lot, receipt.source || "I", qty, Boolean(receipt.balance));
    const prev = policy.get(lot.itemKey);
    const next = receipt.issuePolicy || "today";
    policy.set(lot.itemKey, prev === "all" || next === "all" ? "all" : next);
  }

  for (const [name, value] of Object.entries(raw.issuePolicies || {})) {
    const key = normalizeName(name);
    if (value === "all" || !policy.has(key)) policy.set(key, value);
  }

  ensureRuleLots(lots, orderRef, settings, plan, raw.priceHints || [], date);

  const groups = new Map();
  for (const lot of lots.values()) {
    const list = groups.get(lot.itemKey) || [];
    list.push(lot);
    groups.set(lot.itemKey, list);
  }

  const otherByItem = new Map();
  for (const issue of raw.otherIssues || []) {
    const key = normalizeName(issue.name);
    otherByItem.set(key, add(otherByItem.get(key) || 0n, toScaled(issue.qty)));
  }

  for (const [itemKey, group] of groups) {
    const role = group[0].role;
    if (role === "fuel") {
      allocateFifo(group, plan.fuelAmountScaled);
    } else if (role === "rice") {
      allocateFifo(group, plan.riceKgScaled);
    } else if (role === "milk" && settings.milk.mode !== "purchase") {
      allocateFifo(group, plan.milkQtyScaled);
    } else if (role === "spice") {
      const rule = spiceRuleFor(group[0].name, settings);
      const planned = plan.spices.find((row) => row.match === rule?.match);
      allocateFifo(group, planned?.qtyScaled ?? 0n);
    } else {
      for (const lot of group) {
        lot.mealQty = freshMealQty(lot, policy.get(itemKey) || "today");
      }
    }
    const other = otherByItem.get(itemKey) || 0n;
    if (other !== 0n) allocateOther(group, other);
  }

  const lines = sortLedgerLines(
    [...lots.values()].map(lineFromLot).filter((line) => !isBlankLine(line)),
  ).map((line, index) => ({ ...line, tt: index + 1 }));

  const sumMealOut = sumField(lines, "mealAmount");
  const sumTotalOut = sumField(lines, "totalOutAmount");
  const riceSubsidy = lines
    .filter((line) => line.role === "rice")
    .reduce((acc, line) => {
      const gap = sub(toScaled(line.unitPrice), toScaled(settings.riceSettlementPrice));
      if (gap <= 0n) return acc;
      return add(acc, mul(toScaled(line.mealQty), gap));
    }, 0n);

  const finance = computeFinance({
    settings,
    headcount: raw.headcount,
    prevSurplus: raw.prevSurplus,
    prevShortfall: raw.prevShortfall,
    riceSubsidy,
    otherIncome: raw.otherIncome,
    sumMealOut,
    sumTotalOut,
  });

  const suggestions = suggestBalance(lines, settings);
  const warnings = suggestions.map((row) => ({
    code: "negative_stock",
    name: row.name,
    message: `${row.name} âm ${row.shortfall} ${row.uom}. Đề nghị nhập ${row.suggestQty} ${row.uom} vào Đơn vị BĐ mua TT.`,
    ...row,
  }));
  if (finance.balanceWarn) {
    warnings.push({
      code: "balance_threshold",
      message: `Thừa/thiếu trong ngày đạt ngưỡng ${settings.balanceWarnThreshold} đồng.`,
    });
  }

  return {
    date,
    plan: {
      servings: plan.servings,
      riceKg: plan.riceKg,
      fuelAmount: plan.fuelAmount,
      milkQty: plan.milkQty,
      spices: plan.spices.map(({ match, qty }) => ({ match, qty })),
    },
    lines,
    finance,
    suggestions,
    warnings,
    totals: {
      openingAmount: scaledToString(sumField(lines, "openingAmount")),
      inAmount: scaledToString(sumField(lines, "inAmount")),
      totalInAmount: scaledToString(sumField(lines, "totalInAmount")),
      mealAmount: scaledToString(sumField(lines, "mealAmount")),
      otherAmount: scaledToString(sumField(lines, "otherAmount")),
      totalOutAmount: scaledToString(sumField(lines, "totalOutAmount")),
    },
    closingLots: lines
      .filter((line) => toScaled(line.closingQty) !== 0n)
      .map((line) => ({
        name: line.name,
        uom: line.uom,
        unitPrice: line.unitPrice,
        qty: line.closingQty,
        amount: line.closingAmount,
        commodityId: line.commodityId,
        role: line.role,
        displayDash: line.displayDash,
        receivedDate: line.receivedDate,
      })),
  };
}

function isBlankLine(line) {
  const fields = ["openingQty", "inG", "inH", "inI", "inJ", "mealQty", "otherQty"];
  return fields.every((field) => toScaled(line[field]) === 0n);
}

function ensureRuleLots(lots, orderRef, settings, plan, hints, date) {
  const have = (role, match) => [...lots.values()].some((lot) => {
    if (lot.role !== role) return false;
    return match ? nameMatchesRule(lot.name, match) : true;
  });
  const hintFor = (role, match) => hints.find((hint) => {
    const roleOk = (hint.role || classifyItem(hint.name, hint.uom, settings)) === role;
    return roleOk && (!match || nameMatchesRule(hint.name, match));
  });
  if (plan.riceKgScaled > 0n && !have("rice")) {
    const hint = hintFor("rice");
    ensureLot(lots, orderRef, {
      name: hint?.name || "Gạo",
      uom: hint?.uom || "Kg",
      unitPrice: hint?.unitPrice ?? settings.riceSettlementPrice,
      commodityId: hint?.commodityId ?? null,
      role: "rice",
      receivedDate: date,
    });
  }
  for (const spice of plan.spices) {
    if (spice.qtyScaled === 0n || have("spice", spice.match)) continue;
    const hint = hintFor("spice", spice.match);
    if (!hint) continue;
    ensureLot(lots, orderRef, {
      name: hint.name,
      uom: hint.uom,
      unitPrice: hint.unitPrice,
      commodityId: hint.commodityId ?? null,
      role: "spice",
      receivedDate: date,
    });
  }
  if (plan.milkQtyScaled > 0n && settings.milk.mode !== "purchase" && !have("milk")) {
    const hint = hintFor("milk");
    if (hint) {
      ensureLot(lots, orderRef, {
        name: hint.name,
        uom: hint.uom || "Hộp",
        unitPrice: hint.unitPrice,
        commodityId: hint.commodityId ?? null,
        role: "milk",
        receivedDate: date,
      });
    }
  }
  if (plan.fuelAmountScaled > 0n && !have("fuel")) {
    ensureLot(lots, orderRef, {
      name: "Chất đốt",
      uom: "đ",
      unitPrice: 1,
      role: "fuel",
      displayDash: true,
      receivedDate: date,
    });
  }
}

export {
  classifyItem,
  planRations,
  computeFinance,
  computeLedger,
  suggestBalance,
  splitLedgerPages,
};
