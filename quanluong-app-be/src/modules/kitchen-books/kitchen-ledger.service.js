import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { resolvePrivateStorageUnitId } from "../../shared/data-scope/unit-data-policy.service.js";
import { assembleLedgerInput } from "./kitchen-ledger-assemble.js";
import { computeLedger } from "./kitchen-ledger-compute.js";
import { buildDayStructure } from "./kitchen-ledger-day-structure.js";
import { buildDayFrame } from "./kitchen-ledger-frame.js";
import {
  lockAfterSync,
  negativeItems,
  pdfStale,
  rejectReverseSlipWrite,
} from "./kitchen-ledger-rules.js";
import {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenWriteUnit,
  parseDateOnly,
} from "./kitchen-books-scope.helpers.js";
import { alignHeadcount, withUnitMealLevels, writeStandardMealSelection } from "./kitchen-ledger-meal-rates.js";
import { mergeLedgerSettings } from "./kitchen-ledger-settings.js";

function ymd(date) {
  const d = parseDateOnly(date);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

function shiftDate(date, days) {
  const d = parseDateOnly(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function assertScope(unitId, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
}

function dec(value) {
  return value == null ? "0" : String(value);
}

function movementDto(row) {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    commodityId: row.commodityId,
    itemName: row.itemName,
    measureUnit: row.measureUnit,
    unitPrice: dec(row.unitPrice),
    qty: dec(row.qty),
    issuePolicy: row.issuePolicy,
    sourceKind: row.sourceKind || null,
    grade: row.grade || null,
    manualTemporary: Boolean(row.manualTemporary),
  };
}

function throwDenied(result) {
  if (!result || result.ok) return;
  throw new AppError({
    message: result.message,
    statusCode: result.statusCode,
    code: result.code,
    details: result.details,
  });
}

function changeSnapshot(day, view) {
  return {
    status: view?.status || day?.status || null,
    version: view?.version ?? day?.version ?? 0,
    fingerprint: view?.fingerprint || day?.slipFingerprint || null,
    lockedAt: day?.lockedAt ?? null,
  };
}

function normalizeHeadcount(raw, settings) {
  return alignHeadcount(raw, settings.levels);
}

function incomeOf(raw) {
  return {
    anThem: Number(raw?.anThem) || 0,
    truyLinh: Number(raw?.truyLinh) || 0,
    thuKhach: Number(raw?.thuKhach) || 0,
    riceSubsidy: Number(raw?.riceSubsidy) || 0,
  };
}

function scheduleOf(raw) {
  const text = String(raw?.text ?? "").trim();
  if (!text) return null;
  return { text: text.slice(0, 2000) };
}

async function loadSettings(unitId) {
  const row = await prisma.kitchenLedgerSettings.findUnique({ where: { unitId } });
  return mergeLedgerSettings(row?.configJson);
}

async function loadEffectiveSettings(unitId, ledgerDate) {
  const settings = await loadSettings(unitId);
  return withUnitMealLevels(prisma, unitId, settings, ymd(ledgerDate));
}

async function loadCommodityMap(storageUnitId) {
  const rows = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId },
    select: {
      id: true,
      name: true,
      measureUnit: true,
      sourceKind: true,
      grade: true,
      group: { select: { code: true, sortOrder: true } },
    },
  });
  return new Map(rows.map((row) => [row.id, {
    name: row.name,
    measureUnit: row.measureUnit,
    sourceKind: row.sourceKind || null,
    grade: row.grade || null,
    groupCode: row.group?.code || "",
    groupSort: row.group?.sortOrder ?? null,
  }]));
}

async function findDay(unitId, ledgerDate) {
  return prisma.kitchenLedgerDay.findUnique({
    where: { unitId_ledgerDate: { unitId, ledgerDate } },
    include: {
      movements: { orderBy: { sortOrder: "asc" } },
      changes: { orderBy: { id: "desc" }, take: 30 },
    },
  });
}

async function loadPriceRows(storageUnitId, ledgerDate) {
  const table = await prisma.lttpPriceTable.findFirst({
    where: { unitId: storageUnitId, effectiveDate: { lte: ledgerDate } },
    orderBy: { effectiveDate: "desc" },
    include: { rows: { include: { commodity: true } } },
  });
  const priceRows = (table?.rows || []).map((row) => ({
    commodityId: row.commodityId,
    name: row.commodity?.name ?? "",
    measureUnit: row.commodity?.measureUnit ?? "",
    unitPrice: row.unitPrice == null ? null : dec(row.unitPrice),
    tgsxPrice: row.tgsxPrice == null ? null : dec(row.tgsxPrice),
  }));
  return {
    priceTablePresent: Boolean(table),
    priceTable: table
      ? { id: table.id, effectiveDate: ymd(table.effectiveDate) }
      : null,
    priceRows,
  };
}

async function loadSlips(unitId, ledgerDate) {
  const slips = await prisma.lttpIssueSlip.findMany({
    where: { recipientUnitId: unitId, issueDate: ledgerDate },
    orderBy: [{ slipNo: "asc" }, { id: "asc" }],
    include: { lines: { include: { commodity: { include: { group: { select: { code: true, sortOrder: true } } } } } } },
  });
  return slips.map((slip) => ({
    id: slip.id,
    slipNo: slip.slipNo,
    unitId: slip.unitId,
    recipientUnitId: slip.recipientUnitId,
    issueDate: slip.issueDate,
    updatedAt: slip.updatedAt,
    lines: (slip.lines || []).map((line) => ({
      id: line.id,
      commodityId: line.commodityId,
      quantity: dec(line.quantity),
      unitPrice: dec(line.unitPrice),
      tgsxPrice: line.tgsxPrice == null ? null : dec(line.tgsxPrice),
      priceKind: line.priceKind,
      lineNote: line.lineNote || "",
      commodity: line.commodity,
    })),
  }));
}

function mapPrevLots(prev) {
  return (prev?.lots || []).map((lot) => ({
    name: lot.itemName,
    uom: lot.measureUnit,
    unitPrice: dec(lot.unitPrice),
    qty: dec(lot.qty),
    commodityId: lot.commodityId,
    receivedDate: ymd(lot.receivedDate),
    displayDash: lot.displayDash,
    role: lot.role,
  }));
}

async function loadUnitSelfLines(unitId, ledgerDate) {
  if (typeof prisma.kitchenReceiptSlip?.findUnique !== "function") return [];
  const slip = await prisma.kitchenReceiptSlip.findUnique({
    where: { unitId_receiptDate: { unitId, receiptDate: ledgerDate } },
    include: {
      lines: {
        where: { lineSource: "unit_self" },
        include: { commodity: { include: { group: { select: { code: true, sortOrder: true } } } } },
      },
    },
  });
  return (slip?.lines || []).map((line) => ({
    source: line.priceKind === "tgsx" ? "J" : "I",
    commodityId: line.commodityId,
    qty: dec(line.quantity),
    unitPrice: dec(line.unitPrice),
    commodity: line.commodity,
  }));
}

async function countManualEntries(unitId) {
  if (typeof prisma.kitchenLedgerMovement?.count !== "function") return null;
  return prisma.kitchenLedgerMovement.count({
    where: {
      day: { unitId },
      kind: { in: ["self_supply", "rice", "meal_out", "other_out", "opening"] },
    },
  });
}

async function buildView(unitId, ledgerDate, dataScope, opts = {}) {
  const resolved = await loadEffectiveSettings(unitId, ledgerDate);
  const settings = resolved.settings;
  const mealRates = resolved.mealRates;
  const day = opts.day ?? await findDay(unitId, ledgerDate);
  const slips = await loadSlips(unitId, ledgerDate);
  function withStructure(view) {
    const structure = buildDayStructure(view);
    const next = { ...view, structure };
    return { ...next, frame: buildDayFrame(next, slips) };
  }
  const prices = await loadPriceRows(dataScope.storageUnitId, ledgerDate);
  const prev = await prisma.kitchenLedgerDay.findUnique({
    where: { unitId_ledgerDate: { unitId, ledgerDate: shiftDate(ledgerDate, -1) } },
    include: { lots: { orderBy: { sortOrder: "asc" } } },
  });
  const movements = (day?.movements || []).filter((row) => !(opts.ignoreBalance && row.kind === "balance"));
  const isDay1 = ledgerDate.getUTCDate() === 1;
  const assembledMovements = movements
    .map((row) => ({
      kind: row.kind,
      source: row.source,
      commodityId: row.commodityId,
      itemName: row.itemName,
      measureUnit: row.measureUnit,
      unitPrice: dec(row.unitPrice),
      qty: dec(row.qty),
      issuePolicy: row.issuePolicy,
      sourceKind: row.sourceKind || null,
      grade: row.grade || null,
    }));

  let prevSurplus = "0";
  let prevShortfall = "0";
  if (day?.openingFinanceJson && (isDay1 || !prev?.snapshotJson?.finance)) {
    prevSurplus = dec(day.openingFinanceJson.surplus);
    prevShortfall = dec(day.openingFinanceJson.shortfall);
  } else if (prev?.snapshotJson?.finance) {
    prevSurplus = dec(prev.snapshotJson.finance.surplus);
    prevShortfall = dec(prev.snapshotJson.finance.shortfall);
  }

  const headcount = normalizeHeadcount(day?.headcountJson, settings);
  const unitSlipLines = await loadUnitSelfLines(unitId, ledgerDate);
  const commodityById = await loadCommodityMap(dataScope.storageUnitId);
  const openingLots = mapPrevLots(prev);
  const assembled = assembleLedgerInput({
    date: ymd(ledgerDate),
    settings,
    slips,
    movements: assembledMovements,
    unitSlipLines,
    priceRows: prices.priceRows,
    priceTablePresent: prices.priceTablePresent,
    openingLots,
    commodityById,
  });

  const locked = day?.status === "locked";
  const base = {
    unitId,
    date: ymd(ledgerDate),
    dayId: day?.id ?? null,
    status: day?.status ?? "draft",
    lockedAt: day?.lockedAt ?? null,
    needsResignature: Boolean(day?.needsResignature),
    selfSupplyNone: Boolean(day?.selfSupplyNone),
    headcountSaved: Boolean(day?.headcountJson),
    openingFinance: day?.openingFinanceJson
      ? {
        surplus: dec(day.openingFinanceJson.surplus),
        shortfall: dec(day.openingFinanceJson.shortfall),
      }
      : null,
    headcount,
    previousHeadcount: prev?.headcountJson ? normalizeHeadcount(prev.headcountJson, settings) : null,
    otherIncome: incomeOf(day?.otherIncomeJson),
    schedule: scheduleOf(day?.scheduleJson),
    movements: (day?.movements || []).map(movementDto),
    settings,
    mealRates,
    carriedFrom: prev ? ymd(prev.ledgerDate) : null,
    slipCount: assembled.slipCount,
    manualEntryCounts: assembled.manualEntryCounts,
    manualEntryCount: await countManualEntries(unitId),
    priceTable: prices.priceTable,
    blockers: assembled.blockers,
    warnings: assembled.warnings,
    canEdit: !locked,
    version: day?.version ?? 0,
    pdfStale: pdfStale({ pdfFingerprint: day?.pdfFingerprint, fingerprint: assembled.fingerprint }),
    changes: (day?.changes || []).map((row) => ({
      id: row.id,
      action: row.action,
      source: row.source,
      reason: row.reason || "",
      at: row.createdAt,
      userId: row.userId,
    })),
  };

  if (locked && day.snapshotJson?.lines && !opts.recompute) {
    const mismatch = Boolean(day.slipFingerprint && day.slipFingerprint !== assembled.fingerprint);
    return withStructure({
      ...base,
      ledgerBlocked: false,
      slipMismatch: mismatch,
      slipMismatchMessage: mismatch
        ? "Phiếu xuất đã đổi. Cột Trên BĐ sẽ được lấy lại từ phiếu."
        : null,
      lines: day.snapshotJson.lines,
      finance: day.snapshotJson.finance,
      totals: day.snapshotJson.totals,
      plan: day.snapshotJson.plan,
      suggestions: [],
      warnings: [...assembled.warnings, ...(day.snapshotJson.warnings || [])],
      canLock: false,
      canExport: negativeItems(day.snapshotJson.lines, ymd(ledgerDate)).length === 0,
      fingerprint: assembled.fingerprint,
    });
  }

  if (assembled.blockers.length) {
    return withStructure({
      ...base,
      ledgerBlocked: true,
      slipMismatch: false,
      slipMismatchMessage: null,
      lines: [],
      finance: null,
      totals: null,
      plan: null,
      suggestions: [],
      canLock: false,
      fingerprint: assembled.fingerprint,
    });
  }

  const computed = computeLedger({
    ...assembled.input,
    headcount,
    otherIncome: base.otherIncome,
    prevSurplus,
    prevShortfall,
  });
  return withStructure({
    ...base,
    ledgerBlocked: false,
    slipMismatch: false,
    slipMismatchMessage: null,
    lines: computed.lines,
    finance: computed.finance,
    totals: computed.totals,
    plan: computed.plan,
    suggestions: computed.suggestions,
    warnings: [...assembled.warnings, ...computed.warnings],
    closingLots: computed.closingLots,
    canLock: !locked && Boolean(day?.headcountJson) && negativeItems(computed.lines, ymd(ledgerDate)).length === 0,
    canExport: negativeItems(computed.lines, ymd(ledgerDate)).length === 0,
    fingerprint: assembled.fingerprint,
  });
}

async function recordChange(tx, row) {
  if (typeof tx.kitchenLedgerChange?.create !== "function" || !row) return;
  await tx.kitchenLedgerChange.create({
    data: {
      dayId: row.dayId,
      userId: row.userId ?? null,
      action: row.action,
      source: row.source || "manual",
      reason: row.reason ? String(row.reason).slice(0, 500) : null,
      beforeJson: row.before ?? null,
      afterJson: row.after ?? null,
    },
  });
}

async function persistComputed(dayId, view, { lock = false, userId = null, resign = false, revertDraft = false, change = null } = {}) {
  const receivedFallback = view.date;
  await prisma.$transaction(async (tx) => {
    await tx.kitchenLedgerLot.deleteMany({ where: { dayId } });
    const lots = view.closingLots || [];
    if (lots.length) {
      await tx.kitchenLedgerLot.createMany({
        data: lots.map((lot, index) => ({
          dayId,
          sortOrder: index,
          commodityId: lot.commodityId ?? null,
          itemName: lot.name,
          measureUnit: lot.uom,
          unitPrice: lot.unitPrice,
          receivedDate: parseDateOnly(lot.receivedDate >= "1970-01-01" ? lot.receivedDate : receivedFallback),
          qty: lot.qty,
          amount: lot.amount,
          role: lot.role,
          displayDash: Boolean(lot.displayDash),
        })),
      });
    }
    await tx.kitchenLedgerDay.update({
      where: { id: dayId },
      data: {
        snapshotJson: {
          lines: view.lines,
          finance: view.finance,
          totals: view.totals,
          warnings: view.warnings,
          plan: view.plan,
        },
        slipFingerprint: view.fingerprint,
        version: { increment: 1 },
        ...(resign ? { needsResignature: true } : {}),
        ...(lock
          ? {
            status: "locked",
            lockedAt: new Date(),
            lockedById: userId,
          }
          : {}),
        ...(revertDraft
          ? {
            status: "draft",
            lockedAt: null,
            lockedById: null,
            needsResignature: true,
          }
          : {}),
      },
    });
    if (change) await recordChange(tx, { ...change, dayId });
  });
}

async function ensureDay(unitId, ledgerDate) {
  return prisma.kitchenLedgerDay.upsert({
    where: { unitId_ledgerDate: { unitId, ledgerDate } },
    create: { unitId, ledgerDate, status: "draft" },
    update: {},
    include: { movements: { orderBy: { sortOrder: "asc" } } },
  });
}

function assertDraft(day) {
  if (day?.status === "locked") {
    throw new AppError({
      message: "Ngày đã chốt, không sửa được.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
}


async function getLedger(query, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(query.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  return buildView(unitId, parseDateOnly(query.date), dataScope);
}

async function saveLedger(payload, scope, effectiveUnitIds, dataScope, actor = {}) {
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const ledgerDate = parseDateOnly(payload.date);
  const existing = await findDay(unitId, ledgerDate);
  assertDraft(existing);
  if (payload.version != null && existing && Number(existing.version) !== Number(payload.version)) {
    throw new AppError({
      message: "Sổ đã được sửa. Tải lại ngày trước khi ghi.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  const settings = (await loadEffectiveSettings(unitId, ledgerDate)).settings;
  const day = existing ?? await ensureDay(unitId, ledgerDate);
  const quantityIgnored = Boolean(payload.selfSupply || payload.rice || payload.mealOut || payload.otherOut || payload.opening?.lines);
  const data = {};
  if (payload.headcount) data.headcountJson = normalizeHeadcount(payload.headcount, settings);
  if (payload.otherIncome) data.otherIncomeJson = incomeOf(payload.otherIncome);
  if (payload.schedule !== undefined) data.scheduleJson = scheduleOf(payload.schedule);
  if (payload.selfSupply) data.selfSupplyNone = Boolean(payload.selfSupply.none);
  if (payload.opening && (payload.opening.surplus != null || payload.opening.shortfall != null)) {
    data.openingFinanceJson = {
      surplus: payload.opening.surplus ?? 0,
      shortfall: payload.opening.shortfall ?? 0,
    };
  }
  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) {
      await tx.kitchenLedgerDay.update({ where: { id: day.id }, data });
    }
  });
  const view = await buildView(unitId, ledgerDate, dataScope);
  if (view.dayId) {
    await persistComputed(view.dayId, view, {
      change: {
        userId: actor.userId ?? null,
        action: "save",
        source: actor.source || "manual",
        before: changeSnapshot(existing),
        after: changeSnapshot(null, view),
      },
    });
  }
  const savedView = await buildView(unitId, ledgerDate, dataScope);
  return quantityIgnored ? { ...savedView, quantityIgnored: true } : savedView;
}

async function lockLedger(payload, userId, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const ledgerDate = parseDateOnly(payload.date);
  const existing = await findDay(unitId, ledgerDate);
  assertDraft(existing);
  if (!existing?.headcountJson) {
    throw new AppError({
      message: "Nhập quân số trước khi chốt ngày.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const view = await buildView(unitId, ledgerDate, dataScope);
  const negatives = negativeItems(view.lines, ymd(ledgerDate));
  if (negatives.length) {
    throw new AppError({
      message: `${negatives[0].name} tồn âm. Không chốt ngày khi còn âm.`,
      statusCode: 409,
      code: "negative_stock",
      details: { items: negatives },
    });
  }
  await persistComputed(view.dayId, view, {
    lock: true,
    userId,
    change: {
      userId,
      action: "lock",
      source: "manual",
      before: changeSnapshot(existing),
      after: { status: "locked" },
    },
  });
  return buildView(unitId, ledgerDate, dataScope);
}

async function unlockLedger(payload, scope, effectiveUnitIds, dataScope, actor = {}) {
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const ledgerDate = parseDateOnly(payload.date);
  const existing = await findDay(unitId, ledgerDate);
  if (existing?.status !== "locked") {
    throw new AppError({
      message: "Ngày chưa chốt.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  const reason = String(payload.reason || "").trim();
  if (!reason) {
    throw new AppError({
      message: "Cần lý do mở khóa.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await prisma.$transaction(async (tx) => {
    await tx.kitchenLedgerDay.update({
      where: { id: existing.id },
      data: { status: "draft", needsResignature: true, version: { increment: 1 } },
    });
    await recordChange(tx, {
      dayId: existing.id,
      userId: actor.userId ?? null,
      action: "unlock",
      source: "manual",
      reason,
      before: changeSnapshot(existing),
      after: { status: "draft" },
    });
  });
  return buildView(unitId, ledgerDate, dataScope);
}

async function balanceLedger() {
  throwDenied(rejectReverseSlipWrite());
}

async function syncLedgerSlip() {
  throwDenied(rejectReverseSlipWrite());
}

async function resyncLedgerAfterSlipChange({ recipientUnitId, dateYmd, actorUserId }) {
  const unitId = Number(recipientUnitId);
  if (!Number.isInteger(unitId) || unitId <= 0 || !dateYmd) return [];
  const resolved = await resolvePrivateStorageUnitId({
    logicalUnitId: unitId,
    dataKind: "LTTP_COMMODITY",
  });
  const dataScope = { logicalUnitId: unitId, storageUnitId: resolved.storageUnitId };
  const start = parseDateOnly(dateYmd);
  const days = await prisma.kitchenLedgerDay.findMany({
    where: { unitId, ledgerDate: { gte: start } },
    orderBy: { ledgerDate: "asc" },
    select: { id: true, ledgerDate: true, status: true, version: true, slipFingerprint: true, lockedAt: true },
  });
  const notices = [];
  for (const day of days) {
    const wasLocked = day.status === "locked";
    const view = await buildView(unitId, day.ledgerDate, dataScope, { recompute: true });
    const negatives = negativeItems(view.lines, ymd(day.ledgerDate));
    const decision = lockAfterSync({ wasLocked, negatives });
    await persistComputed(day.id, view, {
      resign: decision.needsResignature,
      revertDraft: decision.reverted,
      change: {
        userId: actorUserId ?? null,
        action: decision.reverted ? "revert_draft" : "sync",
        source: "slip",
        before: changeSnapshot(day),
        after: {
          status: decision.status,
          negatives: negatives.map((row) => row.name),
        },
      },
    });
    if (decision.reverted) {
      notices.push({
        date: ymd(day.ledgerDate),
        code: "reverted_draft",
        message: `Ngày ${ymd(day.ledgerDate)} về nháp vì tồn âm sau khi phiếu xuất đổi.`,
      });
    }
  }
  return notices;
}

async function getLedgerSettings(query, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(query.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  return { unitId, settings: await loadSettings(unitId) };
}

async function saveLedgerSettings(payload, userId, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const { unitId: _unitId, mealSelection, ...patch } = payload;
  const current = await loadSettings(unitId);
  const configJson = mergeLedgerSettings({ ...current, ...patch });
  await prisma.$transaction(async (tx) => {
    if (mealSelection) await writeStandardMealSelection(tx, unitId, mealSelection);
    await tx.kitchenLedgerSettings.upsert({
      where: { unitId },
      create: { unitId, configJson, updatedById: userId },
      update: { configJson, updatedById: userId },
    });
  });
  return { unitId, settings: configJson };
}

export {
  getLedger,
  saveLedger,
  lockLedger,
  unlockLedger,
  balanceLedger,
  getLedgerSettings,
  saveLedgerSettings,
  syncLedgerSlip,
  resyncLedgerAfterSlipChange,
};
