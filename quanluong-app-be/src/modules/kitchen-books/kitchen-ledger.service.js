import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { assembleLedgerInput } from "./kitchen-ledger-assemble.js";
import { classifyItem, computeLedger } from "./kitchen-ledger-compute.js";
import { buildDayStructure } from "./kitchen-ledger-day-structure.js";
import { buildDayFrame } from "./kitchen-ledger-frame.js";
import {
  editSlipLines,
  mergeSlipDraft,
  normalizeSlipLines,
  slipLineChanges,
} from "./kitchen-ledger-slip-roundtrip.js";
import {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenWriteUnit,
  parseDateOnly,
} from "./kitchen-books-scope.helpers.js";
import { emptyHeadcount, mergeLedgerSettings } from "./kitchen-ledger-settings.js";

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
  };
}

function normalizeHeadcount(raw, settings) {
  const base = emptyHeadcount(settings);
  if (!raw) return base;
  const levels = (raw.levels || []).map((level) => ({
    code: level.code ?? "",
    dailyAmount: Number(level.dailyAmount),
    sang: Number(level.sang) || 0,
    trua: Number(level.trua) || 0,
    chieu: Number(level.chieu) || 0,
  }));
  return {
    levels: levels.length ? levels : base.levels,
    extras: {
      benhXa: Number(raw.extras?.benhXa) || 0,
      benhNhan: Number(raw.extras?.benhNhan) || 0,
      omTrai: Number(raw.extras?.omTrai) || 0,
      leTet: Number(raw.extras?.leTet) || 0,
    },
  };
}

function incomeOf(raw) {
  return {
    anThem: Number(raw?.anThem) || 0,
    truyLinh: Number(raw?.truyLinh) || 0,
    thuKhach: Number(raw?.thuKhach) || 0,
  };
}

function scheduleOf(raw) {
  const text = String(raw?.text ?? "").trim();
  if (!text) return null;
  return { text: text.slice(0, 2000) };
}

function roundMoney2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function loadSettings(unitId) {
  const row = await prisma.kitchenLedgerSettings.findUnique({ where: { unitId } });
  return mergeLedgerSettings(row?.configJson);
}

async function findDay(unitId, ledgerDate) {
  return prisma.kitchenLedgerDay.findUnique({
    where: { unitId_ledgerDate: { unitId, ledgerDate } },
    include: { movements: { orderBy: { sortOrder: "asc" } } },
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
    include: { lines: { include: { commodity: true } } },
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

async function buildView(unitId, ledgerDate, dataScope, opts = {}) {
  const settings = await loadSettings(unitId);
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
  const openingMovements = movements.filter((row) => row.kind === "opening");
  const isDay1 = ledgerDate.getUTCDate() === 1;
  const useStockCount = openingMovements.length > 0 && (isDay1 || !prev);
  const assembledMovements = (useStockCount ? movements : movements.filter((row) => row.kind !== "opening"))
    .map((row) => ({
      kind: row.kind,
      source: row.source,
      commodityId: row.commodityId,
      itemName: row.itemName,
      measureUnit: row.measureUnit,
      unitPrice: dec(row.unitPrice),
      qty: dec(row.qty),
      issuePolicy: row.issuePolicy,
    }));

  let prevSurplus = "0";
  let prevShortfall = "0";
  if (day?.openingFinanceJson && (useStockCount || isDay1)) {
    prevSurplus = dec(day.openingFinanceJson.surplus);
    prevShortfall = dec(day.openingFinanceJson.shortfall);
  } else if (prev?.snapshotJson?.finance) {
    prevSurplus = dec(prev.snapshotJson.finance.surplus);
    prevShortfall = dec(prev.snapshotJson.finance.shortfall);
  } else if (day?.openingFinanceJson) {
    prevSurplus = dec(day.openingFinanceJson.surplus);
    prevShortfall = dec(day.openingFinanceJson.shortfall);
  }

  const headcount = normalizeHeadcount(day?.headcountJson, settings);
  const assembled = assembleLedgerInput({
    date: ymd(ledgerDate),
    settings,
    slips,
    movements: assembledMovements,
    priceRows: prices.priceRows,
    priceTablePresent: prices.priceTablePresent,
    openingLots: useStockCount ? [] : mapPrevLots(prev),
    commodityById: new Map(),
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
    carriedFrom: useStockCount ? "stock_count" : prev ? ymd(prev.ledgerDate) : null,
    slipCount: assembled.slipCount,
    priceTable: prices.priceTable,
    blockers: assembled.blockers,
    warnings: assembled.warnings,
    canEdit: !locked,
  };

  if (locked && day.snapshotJson?.lines && !opts.recompute) {
    const mismatch = Boolean(day.slipFingerprint && day.slipFingerprint !== assembled.fingerprint);
    return withStructure({
      ...base,
      ledgerBlocked: false,
      slipMismatch: mismatch,
      slipMismatchMessage: mismatch
        ? "Phiếu xuất đã thay đổi sau khi chốt ngày. Số trên sổ là bản đã chốt. Mở khóa ngày để sổ lấy lại phiếu."
        : null,
      lines: day.snapshotJson.lines,
      finance: day.snapshotJson.finance,
      totals: day.snapshotJson.totals,
      plan: day.snapshotJson.plan,
      suggestions: [],
      warnings: [...assembled.warnings, ...(day.snapshotJson.warnings || [])],
      canLock: false,
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
    canLock: !locked && Boolean(day?.headcountJson),
    fingerprint: assembled.fingerprint,
  });
}

async function persistComputed(dayId, view, { lock = false, userId = null } = {}) {
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
        ...(lock
          ? {
            status: "locked",
            lockedAt: new Date(),
            lockedById: userId,
            slipFingerprint: view.fingerprint,
          }
          : {}),
      },
    });
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

async function commodityOrThrow(storageUnitId, commodityId) {
  const row = await prisma.lttpCommodity.findFirst({
    where: { id: Number(commodityId), unitId: storageUnitId },
  });
  if (!row) {
    throw new AppError({
      message: "Mặt hàng không thuộc đơn vị.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return row;
}

async function rowsForKind(kind, lines, storageUnitId, settings) {
  const rows = [];
  for (const [index, line] of (lines || []).entries()) {
    const commodity = line.commodityId ? await commodityOrThrow(storageUnitId, line.commodityId) : null;
    if (kind === "rice") {
      const name = commodity?.name || line.name || "";
      if (classifyItem(name, commodity?.measureUnit || "Kg", settings) !== "rice") {
        throw new AppError({
          message: "Chỉ gạo được nhập tay vào Trên BĐ mua TT.",
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        });
      }
      if (!commodity && (line.unitPrice == null || line.unitPrice === "")) {
        throw new AppError({
          message: "Dòng gạo chưa có trong danh mục thì cần đơn giá.",
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        });
      }
    }
    if (kind === "other_out" && !commodity && !line.name) {
      throw new AppError({
        message: "Xuất khác thiếu mặt hàng.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    rows.push({
      sortOrder: index,
      kind,
      source: kind === "rice" ? "G" : kind === "other_out" ? "P" : kind === "opening" ? "E" : line.source || "I",
      commodityId: commodity?.id ?? null,
      itemName: commodity?.name || line.name || line.itemName || "",
      measureUnit: commodity?.measureUnit || line.measureUnit || "",
      unitPrice: line.unitPrice ?? 0,
      qty: line.qty,
      issuePolicy: line.issuePolicy || (kind === "balance" ? "keep" : "today"),
    });
  }
  return rows;
}

async function replaceKind(tx, dayId, kind, rows) {
  await tx.kitchenLedgerMovement.deleteMany({ where: { dayId, kind } });
  if (!rows.length) return;
  await tx.kitchenLedgerMovement.createMany({
    data: rows.map((row) => ({ ...row, dayId })),
  });
}

async function getLedger(query, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(query.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  return buildView(unitId, parseDateOnly(query.date), dataScope);
}

async function saveLedger(payload, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const ledgerDate = parseDateOnly(payload.date);
  const existing = await findDay(unitId, ledgerDate);
  assertDraft(existing);
  const settings = await loadSettings(unitId);
  const day = existing ?? await ensureDay(unitId, ledgerDate);
  const storageUnitId = dataScope.storageUnitId;
  const selfRows = payload.selfSupply
    ? await rowsForKind("self_supply", payload.selfSupply.none ? [] : payload.selfSupply.lines || [], storageUnitId, settings)
    : null;
  const riceRows = payload.rice
    ? await rowsForKind("rice", payload.rice.lines, storageUnitId, settings)
    : null;
  const otherRows = payload.otherOut
    ? await rowsForKind("other_out", payload.otherOut.lines, storageUnitId, settings)
    : null;
  const openingRows = payload.opening?.lines
    ? await rowsForKind("opening", payload.opening.lines, storageUnitId, settings)
    : null;
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
    if (selfRows) await replaceKind(tx, day.id, "self_supply", selfRows);
    if (riceRows) await replaceKind(tx, day.id, "rice", riceRows);
    if (otherRows) await replaceKind(tx, day.id, "other_out", otherRows);
    if (openingRows) await replaceKind(tx, day.id, "opening", openingRows);
  });
  const view = await buildView(unitId, ledgerDate, dataScope);
  if (!view.ledgerBlocked && view.dayId) await persistComputed(view.dayId, view);
  return buildView(unitId, ledgerDate, dataScope);
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
  if (view.blockers.length) {
    throw new AppError({
      message: view.blockers[0].message,
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
      details: { blockers: view.blockers },
    });
  }
  await persistComputed(view.dayId, view, { lock: true, userId });
  return buildView(unitId, ledgerDate, dataScope);
}

async function unlockLedger(payload, scope, effectiveUnitIds, dataScope) {
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
  await prisma.kitchenLedgerDay.update({
    where: { id: existing.id },
    data: { status: "draft", needsResignature: true },
  });
  return buildView(unitId, ledgerDate, dataScope);
}

async function balanceLedger(payload, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const ledgerDate = parseDateOnly(payload.date);
  const existing = await findDay(unitId, ledgerDate);
  assertDraft(existing);
  const preview = await buildView(unitId, ledgerDate, dataScope, { ignoreBalance: true, day: existing });
  if (preview.ledgerBlocked) {
    throw new AppError({
      message: preview.blockers[0]?.message || "Chưa đủ phiếu hoặc bảng giá để cân đối.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
      details: { blockers: preview.blockers },
    });
  }
  if (!payload.confirm) {
    return { ...preview, applied: false };
  }
  const settings = await loadSettings(unitId);
  const rows = await rowsForKind(
    "balance",
    preview.suggestions.map((row) => ({
      commodityId: row.commodityId,
      name: row.name,
      measureUnit: row.uom,
      unitPrice: row.unitPrice,
      qty: row.suggestQty,
      source: "I",
      issuePolicy: "keep",
    })),
    dataScope.storageUnitId,
    settings,
  );
  const day = existing ?? await ensureDay(unitId, ledgerDate);
  await prisma.$transaction(async (tx) => {
    await replaceKind(tx, day.id, "balance", rows);
  });
  const view = await buildView(unitId, ledgerDate, dataScope);
  if (!view.ledgerBlocked && view.dayId) await persistComputed(view.dayId, view);
  return { ...(await buildView(unitId, ledgerDate, dataScope)), applied: true };
}

async function writeSlipQuantities(lines) {
  const touched = new Set();
  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const amount = roundMoney2(Number(line.quantity) * Number(line.unitPrice || 0));
      const priceKind = line.priceKind === "tgsx" ? "tgsx" : "market";
      if (line.lineId) {
        await tx.lttpIssueSlipLine.update({
          where: { id: line.lineId },
          data: { quantity: line.quantity, amount },
        });
      } else {
        await tx.lttpIssueSlipLine.create({
          data: {
            slipId: line.slipId,
            commodityId: line.commodityId,
            quantity: line.quantity,
            unitPrice: String(line.unitPrice ?? 0),
            priceKind,
            amount,
            ...(line.lineNote ? { lineNote: String(line.lineNote).slice(0, 500) } : {}),
          },
        });
      }
      if (line.slipId) touched.add(line.slipId);
    }
  });
  return touched;
}

async function afterSlipWrite({ slips, touched, dateYmd, userId }) {
  const changed = slips.filter((slip) => touched.has(slip.id));
  try {
    const { syncKitchenReceiptOnGuaranteeFromIssueSlips } = await import("./kitchen-books-receipt-sync.service.js");
    const recipientUnitId = changed[0]?.recipientUnitId || slips[0]?.recipientUnitId;
    await syncKitchenReceiptOnGuaranteeFromIssueSlips({
      recipientUnitId,
      dateYmd,
      actorUserId: userId,
    });
  } catch (err) {
    console.error("[kitchen-ledger] đồng bộ phiếu nhập sau phiếu xuất", err);
  }
  try {
    const { markChungTuDocumentsStaleForLttpIssueSlipChange } = await import(
      "../chung-tu-quyet-toan/chung-tu-document.service.js"
    );
    for (const slip of changed) {
      await markChungTuDocumentsStaleForLttpIssueSlipChange({
        unitId: slip.unitId,
        recipientUnitId: slip.recipientUnitId,
        issueDate: slip.issueDate,
        issueSlipId: slip.id,
      });
    }
  } catch (err) {
    console.error("[kitchen-ledger] đánh dấu chứng từ cũ sau phiếu xuất", err);
  }
}

async function syncLedgerSlip(payload, userId, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const ledgerDate = parseDateOnly(payload.date);
  const existing = await findDay(unitId, ledgerDate);
  assertDraft(existing);
  const slips = await loadSlips(unitId, ledgerDate);
  if (!slips.length) {
    throw new AppError({
      message: "Chưa có phiếu xuất để ghi cân đối.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  const before = normalizeSlipLines(slips);
  let after;
  if (payload.lines?.length) {
    after = editSlipLines(before, payload.lines);
  } else {
    const view = await buildView(unitId, ledgerDate, dataScope, { day: existing });
    if (!view.frame.slipDraft.length) {
      throw new AppError({
        message: "Không có dòng cân đối để ghi vào phiếu.",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    after = mergeSlipDraft(before, view.frame.slipDraft);
  }
  const changes = slipLineChanges(before, after);
  if (!changes.updates.length && !changes.creates.length) {
    throw new AppError({
      message: changes.skipped.length
        ? "Không ghi được vào phiếu. Dòng chưa có mã hàng, thường là gạo, nhập tay trên sổ."
        : "Không thấy dòng phiếu khớp mặt hàng.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  const touched = await writeSlipQuantities([...changes.updates, ...changes.creates]);
  await afterSlipWrite({ slips, touched, dateYmd: ymd(ledgerDate), userId });
  return buildView(unitId, ledgerDate, dataScope);
}

async function getLedgerSettings(query, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(query.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  return { unitId, settings: await loadSettings(unitId) };
}

async function saveLedgerSettings(payload, userId, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const { unitId: _unitId, ...patch } = payload;
  const current = await loadSettings(unitId);
  const configJson = mergeLedgerSettings({ ...current, ...patch, milk: { ...current.milk, ...(patch.milk || {}) } });
  await prisma.kitchenLedgerSettings.upsert({
    where: { unitId },
    create: { unitId, configJson, updatedById: userId },
    update: { configJson, updatedById: userId },
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
};
