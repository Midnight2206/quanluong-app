/**
 * Sổ nhập xuất LTTP — tính một ngày.
 * Tồn, FIFO và công khai tài chính nằm ở đây để thực đơn tuần và tịnh kho gọi lại,
 * không nhân bản công thức.
 */
import {
  add,
  min,
  mul,
  scaledToString,
  sub,
  toScaled,
} from "./kitchen-ledger-decimal.js";
import { sortLedgerLines } from "./kitchen-ledger-line-order.js";
import { MEALS, mergeLedgerSettings, nameMatchesRule, normalizeName } from "./kitchen-ledger-settings.js";

/** Chỉ xếp dòng gia vị trên ngày chưa có nhóm hàng. Không xuất số. */
const SPICE_PREFIXES = ["dầu ăn", "nước mắm", "muối", "mỳ chính", "mì chính", "tiêu", "ớt bột", "đường", "hành khô", "tỏi khô"];

const EXTRA_KEYS = ["benhXa", "benhNhan", "omTrai", "leTet"];

function classifyItem(name, measureUnit, settings) {
  const n = normalizeName(name);
  const uom = normalizeName(measureUnit);
  const rice = normalizeName(settings?.riceNamePattern || "gạo");
  if (rice && n.includes(rice)) return "rice";
  if (n.includes("chất đốt") || uom === "đ") return "fuel";
  if (SPICE_PREFIXES.some((prefix) => nameMatchesRule(n, prefix))) return "spice";
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

/** Chiều cao in, đã gồm tỉ lệ 97 %. Khớp docs/print-templates/print-spec.md mục 3.4. */
const PRINT_ROW_H = 14.55;
const PRINT_FIRST_BODY = 798.7 - 147.1;
const PRINT_NEXT_BODY = 798.7 - 132.6;
const PRINT_SIGNATURE = 95.2;
const PRINT_NAME_INNER = 156;

function nameUnits(name) {
  const text = String(name || "").trim();
  if (!text) return 1;
  const words = text.split(/\s+/);
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const width = Math.max(word.length, 1) * 4.9 + 3.2;
    if (used > 0 && used + width > PRINT_NAME_INNER) {
      lines += 1;
      used = width;
    } else {
      used += width;
    }
  }
  return lines;
}

function rowPrintHeight(line, rowH) {
  return (line?.printUnits || nameUnits(line?.name)) * rowH;
}

function splitLedgerPages(lines, options = {}) {
  const rowH = options.rowHeight ?? PRINT_ROW_H;
  const firstBody = options.firstBody ?? PRINT_FIRST_BODY;
  const nextBody = options.nextBody ?? PRINT_NEXT_BODY;
  const signature = options.signatureBlock ?? PRINT_SIGNATURE;
  const minTail = options.minTail ?? 2;
  const source = lines || [];
  if (!source.length) return [{ lines: [], carry: null }];
  const height = (line) => rowPrintHeight(line, rowH);
  const sumH = (rows) => rows.reduce((sum, line) => sum + height(line), 0);
  const fitCount = (rows, budget) => {
    let used = 0;
    let count = 0;
    for (const line of rows) {
      const next = height(line);
      if (count > 0 && used + next > budget + 0.05) break;
      used += next;
      count += 1;
      if (next > budget + 0.05) break;
    }
    return count;
  };
  const carryOf = (slice) => ({
    openingAmount: scaledToString(sumField(slice, "openingAmount")),
    inAmount: scaledToString(sumField(slice, "inAmount")),
    totalInAmount: scaledToString(sumField(slice, "totalInAmount")),
    mealAmount: scaledToString(sumField(slice, "mealAmount")),
    otherAmount: scaledToString(sumField(slice, "otherAmount")),
    totalOutAmount: scaledToString(sumField(slice, "totalOutAmount")),
  });
  const pages = [];
  let index = 0;
  let first = true;
  while (index < source.length) {
    const rest = source.slice(index);
    const body = first ? firstBody : nextBody;
    if (sumH(rest) + rowH + signature <= body + 0.05) {
      pages.push({ lines: rest, carry: null });
      break;
    }
    let take = fitCount(rest, body - rowH);
    if (take >= rest.length) take = rest.length - minTail;
    if (rest.length - take < minTail) take = rest.length - minTail;
    if (take < 1) take = 1;
    const slice = rest.slice(0, take);
    index += take;
    pages.push({ lines: slice, carry: index < source.length ? carryOf(slice) : null });
    first = false;
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

function ensureIssuedLots(lots, groups, orderRef, rows, settings, date) {
  for (const issue of rows || []) {
    const key = normalizeName(issue.name);
    if (!key || groups.has(key)) continue;
    const role = classifyItem(issue.name, issue.uom, settings);
    const lot = ensureLot(lots, orderRef, {
      name: issue.name,
      uom: issue.uom || "",
      unitPrice: role === "fuel" ? 1 : (issue.unitPrice ?? 0),
      commodityId: issue.commodityId ?? null,
      role,
      displayDash: role === "fuel",
      receivedDate: date,
    });
    groups.set(key, [lot]);
  }
}

function qtyByName(rows) {
  const map = new Map();
  for (const issue of rows || []) {
    const key = normalizeName(issue.name);
    map.set(key, add(map.get(key) || 0n, toScaled(issue.qty)));
  }
  return map;
}

function computeLedger(raw) {
  const settings = mergeLedgerSettings(raw.settings);
  const date = raw.date || "0000-01-01";
  const lots = new Map();
  const orderRef = { next: 0, byItem: {} };

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
  }

  const groups = new Map();
  for (const lot of lots.values()) {
    const list = groups.get(lot.itemKey) || [];
    list.push(lot);
    groups.set(lot.itemKey, list);
  }
  ensureIssuedLots(lots, groups, orderRef, raw.mealIssues, settings, date);
  ensureIssuedLots(lots, groups, orderRef, raw.otherIssues, settings, date);

  const mealByItem = qtyByName(raw.mealIssues);
  const otherByItem = qtyByName(raw.otherIssues);

  for (const [itemKey, group] of groups) {
    const meal = mealByItem.get(itemKey) || 0n;
    if (meal !== 0n) allocateFifo(group, meal);
    const other = otherByItem.get(itemKey) || 0n;
    if (other !== 0n) allocateOther(group, other);
  }

  const lines = sortLedgerLines(
    [...lots.values()].map(lineFromLot).filter((line) => !isBlankLine(line)),
  ).map((line, index) => ({ ...line, tt: index + 1 }));

  const sumMealOut = sumField(lines, "mealAmount");
  const sumTotalOut = sumField(lines, "totalOutAmount");
  const riceSubsidy = toScaled(raw.riceSubsidy ?? raw.otherIncome?.riceSubsidy ?? 0);

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

  const warnings = lines.filter((line) => line.negative).map((line) => {
    const shortfall = String(line.closingQty).replace(/^-/, "");
    return {
      code: "negative_stock",
      name: line.name,
      uom: line.uom,
      date,
      shortfall,
      message: `${line.name} tồn âm ${shortfall} ${line.uom}. Không chốt và không xuất sổ khi còn âm.`,
    };
  });
  if (finance.balanceWarn) {
    warnings.push({
      code: "balance_threshold",
      message: `Thừa/thiếu trong ngày đạt ngưỡng ${settings.balanceWarnThreshold} đồng.`,
    });
  }

  return {
    date,
    plan: null,
    lines,
    finance,
    suggestions: [],
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

export {
  classifyItem,
  computeFinance,
  computeLedger,
  splitLedgerPages,
};
