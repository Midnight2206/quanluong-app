/**
 * Trang giấy phiếu nhập, phiếu xuất bếp và sổ theo dõi.
 * Số lượng sổ tính từ hai phiếu. Không ghi thu chi vào phiếu.
 */
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenWriteUnit,
  parseDateOnly,
} from "./kitchen-books-scope.helpers.js";
import { bookMmyyFromYmd } from "./kitchen-books-receipt-sync.service.js";
import { mergeLedgerSettings } from "./kitchen-ledger-settings.js";
import {
  addDaysYmd,
  daysOfMonth,
  expandReceiptRow,
  groupIssueLines,
  groupReceiptLines,
  issueQty,
  monthOf,
  negativeStarts,
  presentIssue,
  presentReceipt,
  propagateStock,
  slipNoFromDate,
} from "./kitchen-paper-book.js";

const FORM_CODE = "Mẫu 26: PNX-TMKH/QN25";
const DEFAULT_REASON = "Bảo đảm ăn tại bếp";
const DEFAULT_PLACE = "Lương thực - thực phẩm";

const receiptInclude = {
  lines: { include: { commodity: { include: { group: true } } }, orderBy: { id: "asc" } },
};

const issueInclude = {
  lines: { include: { commodity: { include: { group: true } } }, orderBy: { id: "asc" } },
};

function text(value, max = 191) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function ymdOf(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const date = new Date(value);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function assertDay(unitId, scope, effectiveUnitIds, dataScope) {
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
}

function slotName(signatures, book, key) {
  const hit = (signatures?.[book] || []).find((row) => row?.key === key);
  return hit?.name || "";
}

async function loadContext(unitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: Number(unitId) },
    select: { id: true, name: true, parent: { select: { name: true } } },
  });
  const profile = typeof prisma.chungTuUnitProfile?.findUnique === "function"
    ? await prisma.chungTuUnitProfile.findUnique({ where: { unitId: Number(unitId) } })
    : null;
  const defaults = typeof prisma.lttpUnitIssueFormDefaults?.findUnique === "function"
    ? await prisma.lttpUnitIssueFormDefaults.findUnique({ where: { unitId: Number(unitId) } })
    : null;
  const settingsRow = typeof prisma.kitchenLedgerSettings?.findUnique === "function"
    ? await prisma.kitchenLedgerSettings.findUnique({ where: { unitId: Number(unitId) } })
    : null;
  const signatures = mergeLedgerSettings(settingsRow?.configJson).signatures;
  return {
    unitName: unit?.name || "",
    parentName: profile?.donViCapTren || unit?.parent?.name || "",
    warehouseName: defaults?.warehouseFrom || profile?.boPhan || "",
    formCode: defaults?.formMauSo || FORM_CODE,
    signatures,
  };
}

function headerOf(ctx) {
  return {
    parentName: ctx.parentName,
    unitName: ctx.unitName,
    warehouseName: ctx.warehouseName,
    formCode: ctx.formCode,
  };
}

function receiptSigners(slip, ctx) {
  return [
    slip?.signerLap || slotName(ctx.signatures, "cktc", "nguoi_lap"),
    slip?.signerGiao || "",
    slip?.signerNhan || "",
    slip?.signerDuyet || slotName(ctx.signatures, "cktc", "thu_truong"),
  ];
}

function issueSigners(slip, ctx) {
  return [
    slip?.signerWriter || slotName(ctx.signatures, "cktc", "nguoi_lap"),
    slip?.signerRecipient || "",
    slip?.signerStorekeeper || slotName(ctx.signatures, "soNhapXuat", "quan_ly"),
    slip?.signerApprover || slotName(ctx.signatures, "cktc", "thu_truong"),
  ];
}

function receiptDto(date, slip, ctx) {
  const lines = groupReceiptLines(slip?.lines || []);
  const summary = presentReceipt(lines);
  return {
    date,
    header: headerOf(ctx),
    supplierName: slip?.supplierName || "",
    signers: receiptSigners(slip, ctx),
    lines,
    itemCount: summary.itemCount,
    total: summary.total,
    words: summary.words,
  };
}

function issueDto(date, slip, ctx) {
  const lines = groupIssueLines(slip?.lines || []);
  const summary = presentIssue(lines);
  return {
    date,
    header: headerOf(ctx),
    recipientName: slip?.recipientName || "",
    departmentName: slip?.departmentName || ctx.unitName,
    reason: slip?.reason || DEFAULT_REASON,
    receivePlace: slip?.receivePlace || DEFAULT_PLACE,
    signers: issueSigners(slip, ctx),
    lines,
    itemCount: summary.itemCount,
    total: summary.total,
    words: summary.words,
  };
}

async function assertCommodities(ids, storageUnitId) {
  const unique = [...new Set(ids.map(Number))];
  if (!unique.length) return;
  const rows = await prisma.lttpCommodity.findMany({
    where: { id: { in: unique }, unitId: storageUnitId },
    select: { id: true },
  });
  if (rows.length !== unique.length) {
    throw new AppError({
      message: "Có mặt hàng không thuộc kho của đơn vị",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function ensureReceiptHeader(tx, unitId, date, userId) {
  const receiptDate = parseDateOnly(date);
  const existing = await tx.kitchenReceiptSlip.findUnique({
    where: { unitId_receiptDate: { unitId, receiptDate } },
  });
  if (existing) return existing;
  const bookMmyy = bookMmyyFromYmd(date);
  await tx.kitchenReceiptSlipSerial.upsert({
    where: { unitId_bookMmyy: { unitId, bookMmyy } },
    create: { unitId, bookMmyy, lastSlipNo: 0 },
    update: {},
  });
  const serial = await tx.kitchenReceiptSlipSerial.update({
    where: { unitId_bookMmyy: { unitId, bookMmyy } },
    data: { lastSlipNo: { increment: 1 } },
  });
  return tx.kitchenReceiptSlip.create({
    data: {
      unitId,
      receiptDate,
      createdById: userId,
      bookMmyy,
      slipNo: serial.lastSlipNo,
    },
  });
}

async function getPaperReceipt(query, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(query.unitId);
  assertDay(unitId, scope, effectiveUnitIds, dataScope);
  if (query.month && !query.date) {
    return getPaperReceiptMonth(unitId, query.month, dataScope);
  }
  const slip = await prisma.kitchenReceiptSlip.findUnique({
    where: { unitId_receiptDate: { unitId, receiptDate: parseDateOnly(query.date) } },
    include: receiptInclude,
  });
  const ctx = await loadContext(unitId);
  return receiptDto(query.date, slip, ctx);
}

async function getPaperReceiptMonth(unitId, month, dataScope) {
  const dates = daysOfMonth(month);
  const slips = await prisma.kitchenReceiptSlip.findMany({
    where: {
      unitId,
      receiptDate: { gte: parseDateOnly(dates[0]), lte: parseDateOnly(dates[dates.length - 1]) },
    },
    include: receiptInclude,
  });
  const byDate = new Map(slips.map((slip) => [ymdOf(slip.receiptDate), slip]));
  const ctx = await loadContext(dataScope.logicalUnitId);
  return {
    month,
    days: dates.map((date) => receiptDto(date, byDate.get(date) || null, ctx)),
  };
}

async function putPaperReceipt(body, userId, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(body.unitId);
  assertDay(unitId, scope, effectiveUnitIds, dataScope);
  const ownerUnitId = dataScope.logicalUnitId;
  const expanded = (body.lines || []).flatMap((line) => expandReceiptRow(line));
  await assertCommodities(expanded.map((line) => line.commodityId), dataScope.storageUnitId);
  await prisma.$transaction(async (tx) => {
    const header = await ensureReceiptHeader(tx, ownerUnitId, body.date, userId);
    await tx.kitchenReceiptSlip.update({
      where: { id: header.id },
      data: {
        supplierName: text(body.supplierName),
        signerLap: text(body.signers?.[0]),
        signerGiao: text(body.signers?.[1]),
        signerNhan: text(body.signers?.[2]),
        signerDuyet: text(body.signers?.[3]),
      },
    });
    await tx.kitchenReceiptSlipLine.deleteMany({ where: { slipId: header.id } });
    if (expanded.length) {
      await tx.kitchenReceiptSlipLine.createMany({
        data: expanded.map((line) => ({
          slipId: header.id,
          commodityId: line.commodityId,
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
          tgsxPrice: line.tgsxPrice == null ? null : String(line.tgsxPrice),
          priceKind: line.priceKind,
          lineSource: line.lineSource,
          amount: String(line.amount),
          lineNote: text(line.lineNote, 500),
        })),
      });
    }
  });
  return getPaperReceipt({ unitId: ownerUnitId, date: body.date }, scope, effectiveUnitIds, dataScope);
}

async function ensureIssueHeader(tx, unitId, date, userId) {
  const issueDate = parseDateOnly(date);
  const existing = await tx.kitchenIssueSlip.findUnique({
    where: { unitId_issueDate: { unitId, issueDate } },
  });
  if (existing) return existing;
  return tx.kitchenIssueSlip.create({
    data: {
      unitId,
      issueDate,
      createdById: userId,
      bookMmyy: bookMmyyFromYmd(date),
      slipNo: Number(slipNoFromDate(date)),
    },
  });
}

async function getPaperIssue(query, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(query.unitId);
  assertDay(unitId, scope, effectiveUnitIds, dataScope);
  if (query.month && !query.date) {
    return getPaperIssueMonth(unitId, query.month);
  }
  const slip = typeof prisma.kitchenIssueSlip?.findUnique === "function"
    ? await prisma.kitchenIssueSlip.findUnique({
      where: { unitId_issueDate: { unitId, issueDate: parseDateOnly(query.date) } },
      include: issueInclude,
    })
    : null;
  const ctx = await loadContext(unitId);
  return issueDto(query.date, slip, ctx);
}

async function getPaperIssueMonth(unitId, month) {
  const dates = daysOfMonth(month);
  const slips = await prisma.kitchenIssueSlip.findMany({
    where: {
      unitId,
      issueDate: { gte: parseDateOnly(dates[0]), lte: parseDateOnly(dates[dates.length - 1]) },
    },
    include: issueInclude,
  });
  const byDate = new Map(slips.map((slip) => [ymdOf(slip.issueDate), slip]));
  const ctx = await loadContext(unitId);
  return {
    month,
    days: dates.map((date) => issueDto(date, byDate.get(date) || null, ctx)),
  };
}

async function putPaperIssue(body, userId, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(body.unitId);
  assertDay(unitId, scope, effectiveUnitIds, dataScope);
  const ownerUnitId = dataScope.logicalUnitId;
  const lines = (body.lines || [])
    .map((line) => ({
      commodityId: Number(line.commodityId),
      sang: Number(line.sang) || 0,
      trua: Number(line.trua) || 0,
      chieu: Number(line.chieu) || 0,
      unitPrice: Number(line.price) || 0,
      lineNote: text(line.lineNote, 500),
    }))
    .filter((line) => issueQty(line) !== 0);
  await assertCommodities(lines.map((line) => line.commodityId), dataScope.storageUnitId);
  await prisma.$transaction(async (tx) => {
    const header = await ensureIssueHeader(tx, ownerUnitId, body.date, userId);
    await tx.kitchenIssueSlip.update({
      where: { id: header.id },
      data: {
        recipientName: text(body.recipientName),
        departmentName: text(body.departmentName),
        reason: text(body.reason, 255),
        receivePlace: text(body.receivePlace),
        signerWriter: text(body.signers?.[0]),
        signerRecipient: text(body.signers?.[1]),
        signerStorekeeper: text(body.signers?.[2]),
        signerApprover: text(body.signers?.[3]),
      },
    });
    await tx.kitchenIssueSlipLine.deleteMany({ where: { slipId: header.id } });
    if (lines.length) {
      await tx.kitchenIssueSlipLine.createMany({
        data: lines.map((line) => ({
          slipId: header.id,
          commodityId: line.commodityId,
          sang: String(line.sang),
          trua: String(line.trua),
          chieu: String(line.chieu),
          unitPrice: String(line.unitPrice),
          lineNote: line.lineNote,
        })),
      });
    }
  });
  return getPaperIssue({ unitId: ownerUnitId, date: body.date }, scope, effectiveUnitIds, dataScope);
}

function catalogFromLine(line, sortBase) {
  const groupSort = line.commodity?.group?.sortOrder;
  return {
    name: line.commodity?.name || "",
    uom: line.commodity?.measureUnit || "",
    sort: Number.isFinite(groupSort) ? groupSort : sortBase,
    price: Number(line.unitPrice || line.price || 0),
  };
}

async function getPaperStock(query, scope, effectiveUnitIds, dataScope) {
  const unitId = Number(query.unitId);
  assertDay(unitId, scope, effectiveUnitIds, dataScope);
  const month = query.month;
  const monthDates = daysOfMonth(month);
  const monthEnd = parseDateOnly(monthDates[monthDates.length - 1]);
  const receipts = await prisma.kitchenReceiptSlip.findMany({
    where: { unitId, receiptDate: { lte: monthEnd } },
    include: receiptInclude,
  });
  const issues = typeof prisma.kitchenIssueSlip?.findMany === "function"
    ? await prisma.kitchenIssueSlip.findMany({
      where: { unitId, issueDate: { lte: monthEnd } },
      include: issueInclude,
    })
    : [];
  const movements = {};
  const catalog = {};
  let firstDate = monthDates[0];
  function touch(date, bucket, commodityId, qty, meta) {
    if (!movements[date]) movements[date] = { in: {}, out: {} };
    const prev = Number(movements[date][bucket][commodityId] || 0);
    movements[date][bucket][commodityId] = prev + qty;
    if (!catalog[commodityId]) catalog[commodityId] = meta;
    if (date < firstDate) firstDate = date;
  }
  for (const slip of receipts) {
    const date = ymdOf(slip.receiptDate);
    for (const line of slip.lines || []) {
      const qty = Number(line.quantity);
      if (!qty) continue;
      touch(date, "in", String(line.commodityId), qty, catalogFromLine(line, 1000));
    }
  }
  for (const slip of issues) {
    const date = ymdOf(slip.issueDate);
    for (const line of slip.lines || []) {
      const qty = issueQty(line);
      if (!qty) continue;
      touch(date, "out", String(line.commodityId), qty, catalogFromLine(line, 1000));
    }
  }
  const chainEnd = monthDates[monthDates.length - 1];
  const dates = [];
  for (let cursor = firstDate; cursor <= chainEnd; cursor = addDaysYmd(cursor, 1)) {
    dates.push(cursor);
  }
  const propagated = propagateStock({ dates, movements, catalog });
  const runs = negativeStarts(propagated.days);
  const monthDays = propagated.days.filter((day) => monthOf(day.date) === month);
  const markers = {};
  for (const day of monthDays) {
    markers[day.date] = { hasData: day.hasData, negative: day.negativeCount > 0 };
  }
  return {
    month,
    days: monthDays,
    markers,
    negatives: runs.filter((run) => run.dates.some((date) => monthOf(date) === month)),
  };
}

/** Dòng xuất ăn đưa vào sổ nhập xuất hiện có. Thiếu bảng thì trả mảng rỗng. */
async function loadMealSlipLines(unitId, ledgerDate) {
  if (typeof prisma.kitchenIssueSlip?.findUnique !== "function") return [];
  const slip = await prisma.kitchenIssueSlip.findUnique({
    where: { unitId_issueDate: { unitId, issueDate: ledgerDate } },
    include: { lines: { include: { commodity: true } } },
  });
  return (slip?.lines || []).map((line) => ({
    commodityId: line.commodityId,
    name: line.commodity?.name || "",
    uom: line.commodity?.measureUnit || "",
    unitPrice: line.unitPrice == null ? "0" : String(line.unitPrice),
    qty: String(issueQty(line)),
  })).filter((line) => Number(line.qty) > 0);
}

export {
  getPaperIssue,
  getPaperReceipt,
  getPaperStock,
  loadMealSlipLines,
  putPaperIssue,
  putPaperReceipt,
};
