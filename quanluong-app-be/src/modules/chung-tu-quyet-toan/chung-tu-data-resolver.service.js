import crypto from "node:crypto";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  CHUNG_TU_AGGREGATION_MODES,
  CHUNG_TU_CATEGORY_KEYS,
  assertKnownCategoryKey,
  normalizeAggregationMode,
} from "./chung-tu-category.constants.js";
import {
  formatVndNumber,
  sanitizeDecimal,
  vndToVietnameseDocumentLine,
} from "./chung-tu-vnd.util.js";
import { getChungTuUnitProfile } from "./chung-tu-unit-profile.service.js";
import {
  buildMonthDaySheetNames,
  buildUnitSheetTitles,
  lastDayOfMonth,
  normalizeMonthUnitIds,
  normalizePeriodMonth,
} from "./chung-tu-monthly-sheets.js";
import { getChungTuBkmhHeaderSettings } from "./chung-tu-bkmh-header-settings.service.js";
import { parseBkmhSliceDetailRowsJson, parseTongTien } from "./chung-tu-bkmh-slice-metadata.util.js";
import {
  attachRecipientUnitFillToMonthlyContexts,
  resolveRecipientUnitFillForSlip,
} from "./chung-tu-recipient-unit-fill.service.js";
import { allocateDocNumber } from "./chung-tu-doc-number.service.js";
import {
  buildSheetKey,
  quyenSoFromPeriodMonth,
} from "./chung-tu-doc-number.util.js";
import { formatLyDoXuatKho } from "./chung-tu-pxk-ly-do.util.js";
import { formatCanCuPnkText } from "./chung-tu-nl-field.js";
import { SIGNATURE_CATALOG } from "./chung-tu-signature-catalog.js";

const lineInclude = {
  commodity: { select: { id: true, code: true, name: true, measureUnit: true } },
  lttpSupplier: { select: { id: true, name: true } },
};

const slipInclude = {
  lines: { include: lineInclude, orderBy: { id: "asc" } },
  recipientUnit: { select: { id: true, name: true } },
  buyerUser: { select: { id: true, username: true, profile: { select: { fullName: true } } } },
};

function buyerNameFromSlip(slip) {
  const display = String(slip?.buyerDisplayName ?? "").trim();
  if (display) return display;
  const user = slip?.buyerUser;
  if (!user) return "";
  const fullName = String(user.profile?.fullName ?? user.fullName ?? "").trim();
  if (fullName) return fullName;
  return String(user.username ?? "").trim();
}

function resolveNguoiMuaFromSlips(slips) {
  const ordered = [...(slips ?? [])].sort(
    (a, b) => (a.slipNo ?? 0) - (b.slipNo ?? 0) || Number(a.id ?? 0) - Number(b.id ?? 0),
  );
  const names = new Set();
  for (const slip of ordered) {
    const name = buyerNameFromSlip(slip);
    if (name) names.add(name);
  }
  if (names.size === 1) return [...names][0];
  for (const slip of ordered) {
    const name = buyerNameFromSlip(slip);
    if (name) return name;
  }
  return "";
}

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizePlainObject(value) {
  return value && typeof value === "object" ? value : {};
}

/**
 * Resolve system slots via catalog. Static/prompt slots pass through with resolvedName=null.
 * @param {object[]} slots
 * @param {{ storageUnitId?: number, currentUserId?: number, prisma?: object }} ctx
 * @param {object} [catalog] - injectable for testing
 */
export async function resolveSystemSignatureSlots(slots, ctx, catalog = SIGNATURE_CATALOG) {
  if (!Array.isArray(slots)) return [];
  return Promise.all(
    slots.map(async (slot) => {
      if (slot?.source !== "system") {
        return { ...slot, resolvedName: null, resolvedTitle: null };
      }
      const node = catalog[slot.catalogNodeId];
      if (!node) return { ...slot, resolvedName: null, resolvedTitle: null };
      const result = await node.resolve(ctx).catch(() => null);
      return {
        ...slot,
        resolvedName: result?.signatureName ?? result?.name ?? null,
        resolvedTitle: result?.title ?? null,
      };
    }),
  );
}

/**
 * Document-service chỉ chấp nhận source static|dynamic.
 * System slot đã resolve → static + static_name; chưa resolve → dynamic trống.
 */
export function materializeSignatureBlockForRender(signatureBlock) {
  if (!signatureBlock || typeof signatureBlock !== "object") return signatureBlock;
  if (!Array.isArray(signatureBlock.slots)) return signatureBlock;
  return {
    ...signatureBlock,
    slots: signatureBlock.slots.map((slot) => {
      if (!slot || typeof slot !== "object") return slot;
      if (slot.source !== "system") {
        const { resolvedName: _n, resolvedTitle: _t, catalogNodeId: _c, ...rest } = slot;
        return rest;
      }
      const name = String(slot.resolvedName ?? "").trim();
      const base = {
        key: slot.key,
        label: slot.label,
        col: slot.col,
        col_span: slot.col_span ?? 1,
        show_date_line: Boolean(slot.show_date_line),
      };
      if (name) return { ...base, source: "static", static_name: name };
      return { ...base, source: "dynamic" };
    }),
  };
}

export async function prepareSignatureBlockForRender(signatureBlock, ctx, catalog = SIGNATURE_CATALOG) {
  if (!signatureBlock?.slots) return signatureBlock;
  const resolved = await resolveSystemSignatureSlots(signatureBlock.slots, ctx, catalog);
  return materializeSignatureBlockForRender({ ...signatureBlock, slots: resolved });
}

export function resolvePdfHeaderSettings({
  mergedSettings,
  rawSettings,
  exportingUserProfile,
  categoryKey,
  bkmhHeaderSettings,
  slips,
  resolvedBkmhBuyer = null,
}) {
  const resolved = {
    ...normalizePlainObject(mergedSettings),
  };
  const profile = normalizePlainObject(exportingUserProfile);
  if (exportingUserProfile && typeof exportingUserProfile === "object") {
    const donViCapTren = normalizeText(profile.donViCapTren);
    const donVi = normalizeText(profile.donVi);
    // Always from creating user's profile (not unit profile / recipient unit).
    resolved.donViCapTren = donViCapTren;
    resolved.donVi = donVi;
    if (donVi) {
      resolved.donViSo = donVi;
    }
  }
  if (categoryKey !== CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG) {
    return resolved;
  }
  const settings = normalizePlainObject(rawSettings);
  const buyerName =
    resolvedBkmhBuyer?.name ||
    resolveNguoiMuaFromSlips(slips) ||
    normalizeText(bkmhHeaderSettings?.hoTenNguoiMua);
  const boPhan =
    resolvedBkmhBuyer?.title ||
    normalizeText(settings.boPhan) ||
    normalizeText(resolved.boPhan) ||
    normalizeText(bkmhHeaderSettings?.boPhan);
  return {
    ...resolved,
    signerNguoiMua: buyerName,
    hoTenNguoiMua: buyerName,
    nguoiMua: buyerName,
    boPhan,
  };
}

function ymdParts(periodDate) {
  const d = String(periodDate ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return { ngay: "", thang: "", nam: "" };
  return { ngay: m[3], thang: m[2], nam: m[1] };
}

function defaultBookMmyyFromParts(parts) {
  if (!parts?.thang || !parts?.nam) return "";
  return `${parts.thang}${String(parts.nam).slice(-2)}`;
}

function resolveDocumentNumberFields({ settings, parts, categoryKey, allocation }) {
  void categoryKey;
  const quyenSo =
    allocation?.quyenSo ||
    defaultBookMmyyFromParts(parts) ||
    String(settings?.quyenSo ?? "").trim();
  const soChungTu = allocation?.soChungTu || "";
  return { quyenSo, soChungTu };
}

function defaultSheetKeyForContext(ctx, { categoryKey, aggregationMode } = {}) {
  const mode = normalizeAggregationMode(aggregationMode);
  if (ctx?.issueSlipId) {
    return buildSheetKey({ kind: "slip", issueSlipId: ctx.issueSlipId });
  }
  if (categoryKey === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO) {
    const sliceId = ctx?.sourceSliceId ?? ctx?.bkmhSliceId;
    if (sliceId != null) {
      return buildSheetKey({ kind: "bkmh-slice", bkmhSliceId: sliceId });
    }
  }
  if (mode === CHUNG_TU_AGGREGATION_MODES.BY_DAY) {
    if (
      categoryKey === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO &&
      ctx?.recipientUnitId != null
    ) {
      return buildSheetKey({
        kind: "by-day-pxk",
        recipientUnitId: ctx.recipientUnitId,
        periodDate: ctx.periodDate,
      });
    }
    return buildSheetKey({ kind: "by-day-bkmh", periodDate: ctx.periodDate });
  }
  if (ctx?.recipientUnitId != null) {
    return buildSheetKey({ kind: "by-unit", recipientUnitId: ctx.recipientUnitId });
  }
  return buildSheetKey({ kind: "by-day-bkmh", periodDate: ctx.periodDate });
}

export async function attachDocNumbersToContexts({
  contexts,
  unitId,
  categoryKey,
  periodMonth,
  aggregationMode,
  sheetKeyForContext,
  allocate = allocateDocNumber,
}) {
  const list = Array.isArray(contexts) ? contexts : [];
  if (!list.length) return list;
  const quyenSo =
    quyenSoFromPeriodMonth(periodMonth) ||
    defaultBookMmyyFromParts(ymdParts(list[0]?.periodDate));
  const keyFn =
    typeof sheetKeyForContext === "function"
      ? sheetKeyForContext
      : (ctx) => defaultSheetKeyForContext(ctx, { categoryKey, aggregationMode });
  for (const ctx of list) {
    const sheetKey = keyFn(ctx);
    const allocation = await allocate({ unitId, categoryKey, quyenSo, sheetKey });
    ctx.sheetKey = sheetKey;
    ctx.quyenSo = allocation.quyenSo;
    ctx.soChungTu = allocation.soChungTu;
    ctx.so = allocation.soChungTu;
    ctx.soPhieu = allocation.soChungTu;
  }
  return list;
}

function mapLineRow(line, index) {
  const commodity = line?.commodity ?? null;
  const qty = sanitizeDecimal(
    toFiniteNumber(line?.quantity) ??
      toFiniteNumber(line?.soLuong) ??
      toFiniteNumber(line?.thucNhap) ??
      toFiniteNumber(line?.thucXuat),
  );
  const requiredQty = sanitizeDecimal(
    toFiniteNumber(line?.requiredQuantity) ?? toFiniteNumber(line?.yeuCau),
  );
  const unitPrice = sanitizeDecimal(
    toFiniteNumber(line?.unitPrice) ?? parseTongTien(line?.donGia),
  );
  const amount = sanitizeDecimal(
    toFiniteNumber(line?.amount) ?? parseTongTien(line?.thanhTien),
  );
  const supplierName = String(line?.nguoiBan ?? line?.lttpSupplier?.name ?? "").trim();
  const commodityId =
    toFiniteNumber(commodity?.id) ?? toFiniteNumber(line?.commodityId);
  return {
    stt: index + 1,
    tenHang: commodity?.name ?? line?.tenHang ?? "",
    maSo: commodity?.code ?? line?.maSo ?? "",
    dvt: commodity?.measureUnit ?? line?.dvt ?? "",
    nguoiBan: supplierName,
    yeuCau: requiredQty ?? "",
    thucXuat: qty ?? "",
    thucNhap: qty ?? "",
    soLuong: qty ?? "",
    donGia: unitPrice != null ? formatVndNumber(unitPrice) : "",
    thanhTien: amount != null ? formatVndNumber(amount) : "",
    ghiChu: String(line?.lineNote ?? line?.ghiChu ?? "").trim(),
    commodityId: commodityId != null && commodityId > 0 ? commodityId : null,
    quantity: qty,
    unitPrice,
    amount,
  };
}

function mergeSettings(profile, settings = {}) {
  const s = settings && typeof settings === "object" ? settings : {};
  return {
    donViCapTren: s.donViCapTren ?? profile.donViCapTren ?? "",
    donViSo: s.donViSo ?? profile.donViSo ?? profile.unitName ?? "",
    mauSo: s.mauSo ?? "",
    quyenSo: s.quyenSo ?? profile.quyenSo ?? "",
    soChungTu: s.soChungTu ?? "",
    hoTenNguoiMua: s.hoTenNguoiMua ?? "",
    boPhan: s.boPhan ?? profile.boPhan ?? "",
    noTaiKhoan: s.noTaiKhoan ?? profile.noTaiKhoan ?? "",
    coTaiKhoan: s.coTaiKhoan ?? profile.coTaiKhoan ?? "",
    ghiChu: s.ghiChu ?? "",
    signerWriter: s.signerWriter ?? profile.signerWriter ?? "",
    signerApprover: s.signerApprover ?? profile.signerApprover ?? "",
    signerThird: s.signerThird ?? profile.signerThird ?? "",
    signerNguoiMua: s.signerNguoiMua ?? profile.signerNguoiMua ?? "",
    signerPhuTrachBoPhan: s.signerPhuTrachBoPhan ?? profile.signerPhuTrachBoPhan ?? "",
    signerTaiChinh: s.signerTaiChinh ?? profile.signerTaiChinh ?? "",
    signerLabelWriter: s.signerLabelWriter ?? profile.signerLabelWriter ?? "",
    signerLabelApprover: s.signerLabelApprover ?? profile.signerLabelApprover ?? "",
    signerLabelThird: s.signerLabelThird ?? profile.signerLabelThird ?? "",
    warehouseFrom: s.warehouseFrom ?? profile.warehouseFrom ?? "",
    printLine2: s.printLine2 ?? profile.printLine2 ?? "",
  };
}

async function loadSlipsForDate(unitId, periodDate) {
  const dayStart = new Date(`${periodDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${periodDate}T23:59:59.999Z`);
  return prisma.lttpIssueSlip.findMany({
    where: {
      unitId,
      issueDate: { gte: dayStart, lte: dayEnd },
    },
    include: slipInclude,
    orderBy: [{ slipNo: "asc" }, { id: "asc" }],
  });
}

async function loadSlipsForDateAcrossUnits(unitIds, periodDate) {
  const ids = normalizeMonthUnitIds(unitIds);
  const dayStart = new Date(`${periodDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${periodDate}T23:59:59.999Z`);
  return prisma.lttpIssueSlip.findMany({
    where: {
      recipientUnitId: { in: ids },
      issueDate: { gte: dayStart, lte: dayEnd },
    },
    include: slipInclude,
    orderBy: [{ issueDate: "asc" }, { recipientUnitId: "asc" }, { slipNo: "asc" }, { id: "asc" }],
  });
}

async function loadSlipsForMonthAcrossUnits(unitIds, periodMonth) {
  const ids = normalizeMonthUnitIds(unitIds);
  const month = normalizePeriodMonth(periodMonth);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));
  return prisma.lttpIssueSlip.findMany({
    where: {
      recipientUnitId: { in: ids },
      issueDate: { gte: start, lte: end },
    },
    include: slipInclude,
    orderBy: [{ issueDate: "asc" }, { recipientUnitId: "asc" }, { slipNo: "asc" }, { id: "asc" }],
  });
}

async function loadUnitNameMap(unitIds) {
  const ids = normalizeMonthUnitIds(unitIds);
  if (!ids.length) return new Map();
  const rows = await prisma.unit.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [Number(row.id), row.name ?? ""]));
}

async function loadSlipById(issueSlipId) {
  const slip = await prisma.lttpIssueSlip.findUnique({
    where: { id: issueSlipId },
    include: {
      ...slipInclude,
      unit: { select: { id: true, name: true } },
    },
  });
  if (!slip) {
    throw new AppError({
      message: "Không tìm thấy phiếu xuất LTTP.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return slip;
}

function commodityGroupKey(line) {
  const id = line?.commodity?.id ?? line?.commodityId;
  if (id != null && !Number.isNaN(Number(id))) return `id:${Number(id)}`;
  const code = String(line?.commodity?.code ?? line?.maSo ?? "").trim();
  const name = String(line?.commodity?.name ?? line?.tenHang ?? "").trim();
  const unit = String(line?.commodity?.measureUnit ?? line?.dvt ?? "").trim();
  return `fallback:${code}|${name}|${unit}`;
}

/** Gộp dòng cùng hàng hóa + cùng unitPrice; khác giá → dòng mới (không trung bình). */
function aggregateLinesToDetailRows(rawLines) {
  const groups = new Map();
  for (const line of rawLines ?? []) {
    const unitPrice = Number(line.unitPrice);
    const priceKey = Number.isFinite(unitPrice) ? String(unitPrice) : "__no_price__";
    const key = `${commodityGroupKey(line)}|${priceKey}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        commodity: line.commodity ?? null,
        lttpSupplier: line.lttpSupplier ?? null,
        supplierNames: new Set(),
        quantity: 0,
        requiredQuantity: 0,
        hasRequiredQuantity: false,
        amount: 0,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
        lineNotes: new Set(),
      };
      groups.set(key, group);
    }
    const qty = Number(line.quantity);
    const amount = Number(line.amount);
    const requiredQty = Number(line.requiredQuantity);
    if (Number.isFinite(qty)) group.quantity += qty;
    if (Number.isFinite(amount)) group.amount += amount;
    if (Number.isFinite(requiredQty)) {
      group.requiredQuantity += requiredQty;
      group.hasRequiredQuantity = true;
    }
    const supplierName = String(line.lttpSupplier?.name ?? "").trim();
    if (supplierName) group.supplierNames.add(supplierName);
    const lineNote = String(line.lineNote ?? "").trim();
    if (lineNote) group.lineNotes.add(lineNote);
  }

  return [...groups.values()].map((group, index) => {
    const supplierNames = [...group.supplierNames];
    const lttpSupplier =
      supplierNames.length === 1
        ? { name: supplierNames[0] }
        : supplierNames.length > 1
          ? { name: supplierNames.join(", ") }
          : group.lttpSupplier;
    return mapLineRow(
      {
        commodity: group.commodity,
        lttpSupplier,
        quantity: group.quantity,
        requiredQuantity: group.hasRequiredQuantity ? group.requiredQuantity : null,
        unitPrice: group.unitPrice,
        amount: group.amount,
        lineNote: [...group.lineNotes].join("; "),
      },
      index,
    );
  });
}

function aggregateSnapshotDetailRows(rows) {
  const groups = new Map();
  for (const row of rows ?? []) {
    const unitPrice = toFiniteNumber(row?.unitPrice) ?? parseTongTien(row?.donGia);
    const priceKey = Number.isFinite(unitPrice) ? String(unitPrice) : "__no_price__";
    const key = `${commodityGroupKey(row)}|${priceKey}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        commodity: row?.commodity ?? null,
        commodityId: toFiniteNumber(row?.commodityId),
        tenHang: String(row?.tenHang ?? row?.commodity?.name ?? "").trim(),
        maSo: String(row?.maSo ?? row?.commodity?.code ?? "").trim(),
        dvt: String(row?.dvt ?? row?.commodity?.measureUnit ?? "").trim(),
        quantity: 0,
        amount: 0,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
        supplierNames: new Set(),
        lineNotes: new Set(),
      };
      groups.set(key, group);
    }

    if (!group.commodity && row?.commodity) group.commodity = row.commodity;
    if (group.commodityId == null) group.commodityId = toFiniteNumber(row?.commodityId);
    if (!group.tenHang) group.tenHang = String(row?.tenHang ?? "").trim();
    if (!group.maSo) group.maSo = String(row?.maSo ?? "").trim();
    if (!group.dvt) group.dvt = String(row?.dvt ?? "").trim();

    const qty =
      toFiniteNumber(row?.quantity) ??
      toFiniteNumber(row?.soLuong) ??
      toFiniteNumber(row?.thucNhap);
    const amount = toFiniteNumber(row?.amount) ?? parseTongTien(row?.thanhTien);
    if (Number.isFinite(qty)) group.quantity += qty;
    if (Number.isFinite(amount)) group.amount += amount;

    const supplierName = String(row?.nguoiBan ?? row?.lttpSupplier?.name ?? "").trim();
    if (supplierName) group.supplierNames.add(supplierName);
    const lineNote = String(row?.ghiChu ?? row?.lineNote ?? "").trim();
    if (lineNote) group.lineNotes.add(lineNote);
  }

  return [...groups.values()].map((group, index) =>
    mapLineRow(
      {
        commodity: group.commodity,
        commodityId: group.commodityId,
        tenHang: group.tenHang,
        maSo: group.maSo,
        dvt: group.dvt,
        nguoiBan: [...group.supplierNames].join(", "),
        quantity: group.quantity,
        unitPrice: group.unitPrice,
        amount: group.amount,
        ghiChu: [...group.lineNotes].join("; "),
      },
      index,
    ),
  );
}

function flattenLinesFromSlips(slips) {
  const rows = [];
  for (const slip of slips) {
    for (const line of slip.lines ?? []) {
      rows.push(line);
    }
  }
  return aggregateLinesToDetailRows(rows);
}

function sumAmount(lines) {
  let total = 0;
  for (const line of lines) {
    const n = Number(line.amount);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function toIsoDateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function formatCanCuPnkTextFromSlices(slices) {
  return formatCanCuPnkText(
    (slices ?? []).map((slice) => ({
      soChungTu: slice?.soChungTu,
      periodDate: toIsoDateOnly(slice?.periodDate),
      buyerName: String(slice?.buyerName ?? "").trim(),
    })),
  );
}

function noBkmhMonthlySourceError(periodMonth) {
  return new AppError({
    message: `Không có dữ liệu BKMH tháng ${periodMonth}. Vui lòng xuất BKMH trước khi xuất PNK.`,
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
  });
}

function noBkmhRangeSourceError(dateFrom, dateTo) {
  return new AppError({
    message: `Không có dữ liệu BKMH từ ngày ${dateFrom} đến ${dateTo}. Vui lòng xuất BKMH trước khi xuất PNK.`,
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
  });
}

function missingBkmhBuyerKeyError() {
  return new AppError({
    message: "BKMH thiếu thông tin người mua trên slice. Vui lòng xuất lại BKMH trước khi xuất PNK.",
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
  });
}

function normalizePnkAggregationMode(mode) {
  return String(mode ?? "").trim() === CHUNG_TU_AGGREGATION_MODES.FULL
    ? CHUNG_TU_AGGREGATION_MODES.FULL
    : CHUNG_TU_AGGREGATION_MODES.BY_DAY;
}

function pickFirstNonEmptySliceField(slices, fieldKey) {
  for (const slice of slices ?? []) {
    const value = String(slice?.[fieldKey] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function getLastPeriodDateFromSlices(slices) {
  let last = "";
  for (const slice of slices ?? []) {
    const periodDate = toIsoDateOnly(slice?.periodDate);
    if (periodDate && (!last || periodDate > last)) last = periodDate;
  }
  return last;
}

function buildPnkSheetContext({
  slices,
  periodDate,
  dateFrom,
  dateTo,
  aggregationMode,
  resolveSettingsForSlips,
  lyDoNhapKho,
  nhapTaiKho,
}) {
  const detailRows = aggregateSnapshotDetailRows((slices ?? []).flatMap((slice) => slice.detailRows ?? []));
  if (!detailRows.length) return null;
  const buyerKey = pickFirstNonEmptySliceField(slices, "buyerKey");
  const buyerName = pickFirstNonEmptySliceField(slices, "buyerName");
  const buyerSignatureName = pickFirstNonEmptySliceField(slices, "buyerSignatureName");
  const buyerTitle = pickFirstNonEmptySliceField(slices, "buyerTitle");
  const totalAmount = sumAmount(detailRows);
  const primarySliceId = slices?.[0]?.id ?? null;
  return buildContextBase({
    settings: resolveSettingsForSlips(),
    periodDate,
    detailRows,
    totalAmount,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
    extra: {
      dateFrom,
      dateTo,
      aggregationMode,
      buyerKey,
      buyerSignatureName,
      nguoiGiaoHang: buyerName,
      diaChi: buyerTitle,
      lyDoNhapKho,
      nhapTaiKho,
      sliceCount: slices.length,
      lineCount: detailRows.length,
      canCuPnk: formatCanCuPnkTextFromSlices(slices),
      sourceSliceId: primarySliceId,
      bkmhSliceId: primarySliceId,
    },
  });
}

async function resolvePnkFromBkmhSlices({
  storageUnitId,
  dateFrom,
  dateTo,
  aggregationMode,
  resolveSettingsForSlips,
  lyDoNhapKho,
  nhapTaiKho,
}) {
  const safeDateFrom = toIsoDateOnly(dateFrom);
  const safeDateTo = toIsoDateOnly(dateTo);
  const mode = normalizePnkAggregationMode(aggregationMode);
  const safeLyDoNhapKho = String(lyDoNhapKho ?? "").trim();
  const safeNhapTaiKho = String(nhapTaiKho ?? "").trim();
  const rawSlices = await prisma.chungTuBkmhSlice.findMany({
    where: {
      monthly: {
        is: {
          storageUnitId: Number(storageUnitId),
        },
      },
      periodDate: {
        gte: new Date(`${safeDateFrom}T00:00:00.000Z`),
        lte: new Date(`${safeDateTo}T23:59:59.999Z`),
      },
    },
    select: {
      id: true,
      sortKey: true,
      soChungTu: true,
      periodDate: true,
      recipientUnitId: true,
      recipientUnitName: true,
      ngayThangNam: true,
      detailRowsJson: true,
      buyerKey: true,
      buyerName: true,
      buyerSignatureName: true,
      buyerTitle: true,
    },
    orderBy: [{ periodDate: "asc" }, { sortKey: "asc" }, { id: "asc" }],
  });

  if (!rawSlices.length) {
    throw noBkmhRangeSourceError(safeDateFrom, safeDateTo);
  }

  const sourceSlices = [];
  for (const slice of rawSlices) {
    const periodDate = toIsoDateOnly(slice.periodDate);
    const detailRows = parseBkmhSliceDetailRowsJson(slice.detailRowsJson);
    if (!periodDate || !detailRows.length) continue;
    const buyerKey = String(slice.buyerKey ?? "").trim();
    if (!buyerKey) throw missingBkmhBuyerKeyError();
    sourceSlices.push({
      ...slice,
      periodDate,
      buyerKey,
      buyerName: String(slice.buyerName ?? "").trim(),
      buyerSignatureName: String(slice.buyerSignatureName ?? "").trim(),
      buyerTitle: String(slice.buyerTitle ?? "").trim(),
      detailRows,
    });
  }

  if (!sourceSlices.length) {
    throw noBkmhRangeSourceError(safeDateFrom, safeDateTo);
  }

  const slicesByBuyer = new Map();
  for (const slice of sourceSlices) {
    if (!slicesByBuyer.has(slice.buyerKey)) slicesByBuyer.set(slice.buyerKey, []);
    slicesByBuyer.get(slice.buyerKey).push(slice);
  }

  const sheetContexts = [];
  let monthlyTotal = 0;
  for (const buyerSlices of slicesByBuyer.values()) {
    if (mode === CHUNG_TU_AGGREGATION_MODES.FULL) {
      const periodDate = getLastPeriodDateFromSlices(buyerSlices) || safeDateTo;
      const context = buildPnkSheetContext({
        slices: buyerSlices,
        periodDate,
        dateFrom: safeDateFrom,
        dateTo: safeDateTo,
        aggregationMode: mode,
        resolveSettingsForSlips,
        lyDoNhapKho: safeLyDoNhapKho,
        nhapTaiKho: safeNhapTaiKho,
      });
      if (!context) continue;
      monthlyTotal += context.tongTienSo ?? 0;
      sheetContexts.push(context);
      continue;
    }

    const slicesByDate = new Map();
    for (const slice of buyerSlices) {
      if (!slicesByDate.has(slice.periodDate)) slicesByDate.set(slice.periodDate, []);
      slicesByDate.get(slice.periodDate).push(slice);
    }
    for (const periodDate of [...slicesByDate.keys()].sort()) {
      const context = buildPnkSheetContext({
        slices: slicesByDate.get(periodDate) ?? [],
        periodDate,
        dateFrom: safeDateFrom,
        dateTo: safeDateTo,
        aggregationMode: mode,
        resolveSettingsForSlips,
        lyDoNhapKho: safeLyDoNhapKho,
        nhapTaiKho: safeNhapTaiKho,
      });
      if (!context) continue;
      monthlyTotal += context.tongTienSo ?? 0;
      sheetContexts.push(context);
    }
  }

  if (!sheetContexts.length) {
    throw noBkmhRangeSourceError(safeDateFrom, safeDateTo);
  }

  const rootPeriodDate =
    mode === CHUNG_TU_AGGREGATION_MODES.FULL
      ? getLastPeriodDateFromSlices(sourceSlices) || safeDateTo
      : safeDateFrom;

  return {
    sheetContexts,
    allLines: [],
    allSlips: [],
    sourceSlices,
    monthlyTotal,
    monthlySlipCount: sourceSlices.length,
    rootContext: buildContextBase({
      settings: resolveSettingsForSlips(),
      periodDate: rootPeriodDate,
      detailRows: sheetContexts.flatMap((ctx) => ctx.detailRows ?? []),
      totalAmount: monthlyTotal,
      categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
      extra: {
        dateFrom: safeDateFrom,
        dateTo: safeDateTo,
        aggregationMode: mode,
        sheetContexts,
        lyDoNhapKho: safeLyDoNhapKho,
        nhapTaiKho: safeNhapTaiKho,
        buyerCount: sheetContexts.length,
        sliceCount: sourceSlices.length,
        lineCount: sheetContexts.reduce((sum, ctx) => sum + (ctx.detailRows?.length ?? 0), 0),
        canCuPnk: formatCanCuPnkTextFromSlices(sourceSlices),
      },
    }),
  };
}

function buildContextBase({ settings, periodDate, detailRows, totalAmount, categoryKey, extra = {} }) {
  const parts = ymdParts(periodDate);
  const tongTien = totalAmount;
  const { quyenSo, soChungTu } = resolveDocumentNumberFields({
    settings,
    parts,
    categoryKey,
  });
  return {
    ...settings,
    ...parts,
    ...extra,
    periodDate: periodDate ?? "",
    ngayThangNam:
      parts.ngay && parts.thang && parts.nam
        ? `Ngày ${parts.ngay} tháng ${parts.thang} năm ${parts.nam}`
        : "",
    ngayChungTu: periodDate ?? "",
    quyenSo,
    soChungTu,
    so: soChungTu,
    soPhieu: soChungTu,
    tongTien: formatVndNumber(tongTien),
    tongTienSo: tongTien,
    tongTienBangChu: vndToVietnameseDocumentLine(tongTien),
    detailRows,
  };
}

export function computeSourceDataHash(payload) {
  const raw = JSON.stringify(payload);
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

async function resolveMonthlySheetContexts({
  periodMonth,
  unitIds,
  aggregationMode,
  categoryKey,
  resolveSettingsForSlips,
}) {
  const selectedUnitIds = normalizeMonthUnitIds(unitIds);
  if (!selectedUnitIds.length) {
    throw new AppError({
      message: "Chứng từ theo tháng cần chọn ít nhất một đơn vị.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const mode = normalizeAggregationMode(aggregationMode);
  const safeMonth = normalizePeriodMonth(periodMonth);
  const monthEndDate = lastDayOfMonth(safeMonth);
  const sheetContexts = [];
  const allLines = [];
  let monthlyTotal = 0;
  let monthlySlipCount = 0;
  let allSlipsCollected = [];

  if (mode === CHUNG_TU_AGGREGATION_MODES.BY_DAY) {
    const sheetNames = buildMonthDaySheetNames(safeMonth);
    const unitNameById =
      categoryKey === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO
        ? await loadUnitNameMap(selectedUnitIds)
        : null;
    for (const sheetName of sheetNames) {
      const day = `${safeMonth}-${sheetName}`;
      const slips = await loadSlipsForDateAcrossUnits(selectedUnitIds, day);
      allSlipsCollected.push(...slips);

      if (categoryKey === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO) {
        const slipsByUnit = new Map();
        for (const slip of slips) {
          const uid = Number(slip.recipientUnitId);
          if (!slipsByUnit.has(uid)) slipsByUnit.set(uid, []);
          slipsByUnit.get(uid).push(slip);
        }
        for (const [unitId, unitSlips] of slipsByUnit) {
          const flatLines = unitSlips.flatMap((s) => s.lines ?? []);
          const detailRows = flattenLinesFromSlips(unitSlips);
          if (!detailRows.length) continue;
          const total = sumAmount(flatLines);
          monthlyTotal += total;
          monthlySlipCount += unitSlips.length;
          allLines.push(...flatLines);
          sheetContexts.push(
            buildContextBase({
              settings: resolveSettingsForSlips(unitSlips),
              periodDate: day,
              detailRows,
              totalAmount: total,
              categoryKey,
              extra: {
                sheetName,
                periodMonth: safeMonth,
                selectedUnitIds,
                aggregationMode: mode,
                recipientUnitId: unitId,
                recipientUnitName: unitNameById.get(unitId) ?? "",
                slipCount: unitSlips.length,
                lineCount: detailRows.length,
              },
            }),
          );
        }
        continue;
      }

      const flatLines = slips.flatMap((s) => s.lines ?? []);
      const detailRows = flattenLinesFromSlips(slips);
      const total = sumAmount(flatLines);
      monthlyTotal += total;
      monthlySlipCount += slips.length;
      allLines.push(...flatLines);
      sheetContexts.push(
        buildContextBase({
          settings: resolveSettingsForSlips(slips),
          periodDate: day,
          detailRows,
          totalAmount: total,
          categoryKey,
          extra: {
            sheetName,
            periodMonth: safeMonth,
            selectedUnitIds,
            aggregationMode: mode,
            slipCount: slips.length,
            lineCount: detailRows.length,
          },
        }),
      );
    }
  } else if (mode === CHUNG_TU_AGGREGATION_MODES.BY_UNIT) {
    const unitNameById = await loadUnitNameMap(selectedUnitIds);
    const unitSheets = buildUnitSheetTitles(selectedUnitIds, unitNameById);
    const allSlips = await loadSlipsForMonthAcrossUnits(selectedUnitIds, safeMonth);
    allSlipsCollected = allSlips;
    monthlySlipCount = allSlips.length;
    const slipsByUnit = new Map();
    for (const slip of allSlips) {
      const uid = Number(slip.recipientUnitId);
      if (!slipsByUnit.has(uid)) slipsByUnit.set(uid, []);
      slipsByUnit.get(uid).push(slip);
    }
    for (const { unitId, sheetTitle } of unitSheets) {
      const slips = slipsByUnit.get(unitId) ?? [];
      const flatLines = slips.flatMap((s) => s.lines ?? []);
      const detailRows = flattenLinesFromSlips(slips);
      const total = sumAmount(flatLines);
      monthlyTotal += total;
      allLines.push(...flatLines);
      sheetContexts.push(
        buildContextBase({
          settings: resolveSettingsForSlips(slips),
          periodDate: monthEndDate,
          detailRows,
          totalAmount: total,
          categoryKey,
          extra: {
            sheetName: sheetTitle,
            periodMonth: safeMonth,
            selectedUnitIds: [unitId],
            aggregationMode: mode,
            recipientUnitId: unitId,
            recipientUnitName: unitNameById.get(unitId) ?? "",
            slipCount: slips.length,
            lineCount: detailRows.length,
          },
        }),
      );
    }
  } else {
    const allSlips = await loadSlipsForMonthAcrossUnits(selectedUnitIds, safeMonth);
    allSlipsCollected = allSlips;
    const flatLines = allSlips.flatMap((s) => s.lines ?? []);
    const detailRows = flattenLinesFromSlips(allSlips);
    const total = sumAmount(flatLines);
    monthlyTotal = total;
    monthlySlipCount = allSlips.length;
    allLines.push(...flatLines);
    return {
      sheetContexts: [],
      allLines,
      monthlyTotal,
      monthlySlipCount,
      rootContext: buildContextBase({
        settings: resolveSettingsForSlips(allSlips),
        periodDate: monthEndDate,
        detailRows,
        totalAmount: total,
        categoryKey,
        extra: {
          periodMonth: safeMonth,
          selectedUnitIds,
          aggregationMode: mode,
          slipCount: allSlips.length,
          lineCount: detailRows.length,
        },
      }),
      allSlips: allSlipsCollected,
    };
  }

  const rootPeriodDate =
    mode === CHUNG_TU_AGGREGATION_MODES.BY_DAY ? `${safeMonth}-01` : monthEndDate;

  return {
    sheetContexts,
    allLines,
    monthlyTotal,
    monthlySlipCount,
    rootContext: buildContextBase({
      settings: resolveSettingsForSlips(allSlipsCollected),
      periodDate: rootPeriodDate,
      detailRows: sheetContexts.flatMap((ctx) => ctx.detailRows ?? []),
      totalAmount: monthlyTotal,
      categoryKey,
      extra: {
        periodMonth: safeMonth,
        selectedUnitIds,
        aggregationMode: mode,
        sheetContexts,
        slipCount: monthlySlipCount,
        lineCount: allLines.length,
      },
    }),
    allSlips: allSlipsCollected,
  };
}

function attachPxkSignatureExtraFields(monthly, { xuatTaiKho, diaDiem }) {
  if (!monthly || typeof monthly !== "object") return;
  const safeXuatTaiKho = String(xuatTaiKho ?? "").trim();
  const safeDiaDiem = String(diaDiem ?? "").trim();
  if (monthly.rootContext && typeof monthly.rootContext === "object") {
    monthly.rootContext.xuatTaiKho = safeXuatTaiKho;
    monthly.rootContext.diaDiem = safeDiaDiem;
  }
  for (const ctx of monthly.sheetContexts ?? []) {
    if (!ctx || typeof ctx !== "object") continue;
    ctx.xuatTaiKho = safeXuatTaiKho;
    ctx.diaDiem = safeDiaDiem;
  }
}

export async function resolveChungTuContext({
  categoryKey,
  unitId,
  periodDate,
  periodMonth,
  dateFrom,
  dateTo,
  issueSlipId,
  unitIds,
  aggregationMode,
  settings,
  exportingUserProfile,
  resolvedBkmhBuyer = null,
  lyDoNhapKho,
  nhapTaiKho,
  xuatTaiKho,
  diaDiem,
}) {
  const meta = assertKnownCategoryKey(categoryKey);
  const [profile, bkmhHeaderSettings, catalogBuyer] = await Promise.all([
    getChungTuUnitProfile({ unitId }),
    meta.key === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG
      ? getChungTuBkmhHeaderSettings({ categoryKey: meta.key })
      : null,
    meta.key === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG && !resolvedBkmhBuyer
      ? SIGNATURE_CATALOG["bkmh.nguoiMua"].resolve({ storageUnitId: unitId }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const buyerForHeader = resolvedBkmhBuyer ?? catalogBuyer;
  const merged = mergeSettings(profile, settings);
  const resolveSettingsForSlips = (slips = [], overrides = {}) =>
    resolvePdfHeaderSettings({
      mergedSettings: { ...merged, ...overrides },
      rawSettings: {
        ...normalizePlainObject(settings),
        ...normalizePlainObject(overrides),
      },
      exportingUserProfile,
      categoryKey: meta.key,
      bkmhHeaderSettings,
      slips,
      resolvedBkmhBuyer: buyerForHeader,
    });

  if (meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO && issueSlipId && !periodMonth) {
    const slip = await loadSlipById(issueSlipId);
    if (Number(slip.unitId) !== Number(unitId)) {
      throw new AppError({
        message: "Phiếu xuất không thuộc đơn vị đã chọn.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const period = slip.issueDate.toISOString().slice(0, 10);
    const detailRows = aggregateLinesToDetailRows(slip.lines ?? []);
    const total = sumAmount(slip.lines ?? []);
    const baseSettings = resolveSettingsForSlips();
    const slipSettings = {
      ...baseSettings,
      donViSo: baseSettings.donViSo || slip.printLine1 || slip.unit?.name || "",
      mauSo: baseSettings.mauSo || slip.formMauSo || "",
      quyenSo: baseSettings.quyenSo || slip.bookMmyy || "",
      signerWriter: baseSettings.signerWriter || slip.signerWriter || "",
      signerApprover: baseSettings.signerApprover || slip.signerApprover || "",
      signerRecipient: slip.signerRecipient || slip.recipientDisplayName || slip.recipientUnit?.name || "",
      warehouseFrom: baseSettings.warehouseFrom || slip.warehouseFrom || "",
      printLine1: slip.printLine1 || "",
      printLine2: slip.printLine2 || baseSettings.printLine2 || "",
      ghiChu: baseSettings.ghiChu || slip.note || "",
    };
    const context = buildContextBase({
      settings: resolveSettingsForSlips([slip], slipSettings),
      periodDate: period,
      detailRows,
      totalAmount: total,
      categoryKey: meta.key,
      extra: {
        issueSlipId: slip.id,
        bookMmyy: slip.bookMmyy,
        slipNo: slip.slipNo,
        recipientUnitName: slip.recipientUnit?.name ?? "",
        recipientDisplayName: slip.recipientDisplayName ?? "",
        ...(await resolveRecipientUnitFillForSlip(slip)),
      },
    });
    await attachDocNumbersToContexts({
      contexts: [context],
      unitId,
      categoryKey: meta.key,
      periodMonth: period.slice(0, 7),
      aggregationMode: CHUNG_TU_AGGREGATION_MODES.BY_DAY,
    });
    const hashPayload = {
      categoryKey,
      unitId,
      issueSlipId: slip.id,
      lineIds: (slip.lines ?? []).map((l) => ({
        id: l.id,
        qty: String(l.quantity),
        price: String(l.unitPrice),
        amount: String(l.amount),
      })),
      settings: resolveSettingsForSlips([slip], slipSettings),
    };
    return { context, sourceDataHash: computeSourceDataHash(hashPayload) };
  }

  const safePeriodMonth = periodMonth ? normalizePeriodMonth(periodMonth) : undefined;
  const safePnkDateFrom =
    meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO
      ? toIsoDateOnly(dateFrom) || (safePeriodMonth ? `${safePeriodMonth}-01` : "")
      : "";
  const safePnkDateTo =
    meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO
      ? toIsoDateOnly(dateTo) || (safePeriodMonth ? lastDayOfMonth(safePeriodMonth) : "")
      : "";

  if (meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO && safePnkDateFrom && safePnkDateTo) {
    const monthly = await resolvePnkFromBkmhSlices({
      storageUnitId: unitId,
      dateFrom: safePnkDateFrom,
      dateTo: safePnkDateTo,
      aggregationMode,
      resolveSettingsForSlips,
      lyDoNhapKho,
      nhapTaiKho,
    });
    const pnkMode = normalizePnkAggregationMode(aggregationMode);
    await attachDocNumbersToContexts({
      contexts: monthly.sheetContexts,
      unitId,
      categoryKey: meta.key,
      periodMonth: safePnkDateFrom.slice(0, 7),
      aggregationMode: pnkMode,
    });
    if (monthly.rootContext && monthly.sheetContexts?.length) {
      monthly.rootContext.quyenSo = monthly.sheetContexts[0].quyenSo;
      monthly.rootContext.sheetContexts = monthly.sheetContexts;
    }
    const hashPayload = {
      categoryKey,
      unitId,
      dateFrom: safePnkDateFrom,
      dateTo: safePnkDateTo,
      aggregationMode: pnkMode,
      sourceSlices: (monthly.sourceSlices ?? []).map((slice) => ({
        id: slice.id,
        sortKey: slice.sortKey,
        soChungTu: slice.soChungTu ?? "",
        periodDate: slice.periodDate,
        buyerKey: slice.buyerKey ?? "",
        buyerName: slice.buyerName ?? "",
        buyerSignatureName: slice.buyerSignatureName ?? "",
        buyerTitle: slice.buyerTitle ?? "",
        recipientUnitId: slice.recipientUnitId ?? null,
        detailRows: (slice.detailRows ?? []).map((row) => ({
          commodityId: row.commodityId ?? null,
          tenHang: row.tenHang ?? "",
          maSo: row.maSo ?? "",
          dvt: row.dvt ?? "",
          quantity: row.quantity ?? row.soLuong ?? null,
          unitPrice: row.unitPrice ?? row.donGia ?? null,
          amount: row.amount ?? row.thanhTien ?? null,
        })),
      })),
      settings: resolveSettingsForSlips(),
      lyDoNhapKho: String(lyDoNhapKho ?? "").trim(),
      nhapTaiKho: String(nhapTaiKho ?? "").trim(),
    };
    return {
      context: monthly.rootContext,
      sourceDataHash: computeSourceDataHash(hashPayload),
    };
  }

  if (periodMonth) {
    const monthly = await resolveMonthlySheetContexts({
      periodMonth,
      unitIds,
      aggregationMode,
      categoryKey: meta.key,
      resolveSettingsForSlips,
    });
    await attachRecipientUnitFillToMonthlyContexts(monthly, { aggregationMode });
    const safeMonth = normalizePeriodMonth(periodMonth);
    const mode = normalizeAggregationMode(aggregationMode);
    await attachDocNumbersToContexts({
      contexts: monthly.sheetContexts,
      unitId,
      categoryKey: meta.key,
      periodMonth: safeMonth,
      aggregationMode: mode,
    });
    if (monthly.rootContext && monthly.sheetContexts?.length) {
      monthly.rootContext.quyenSo = monthly.sheetContexts[0].quyenSo;
      monthly.rootContext.soChungTu = "";
      monthly.rootContext.so = "";
      monthly.rootContext.soPhieu = "";
      monthly.rootContext.sheetContexts = monthly.sheetContexts;
    }
    if (meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO) {
      const pxkMode = mode;
      for (const ctx of monthly.sheetContexts ?? []) {
        ctx.lyDoXuatKho = formatLyDoXuatKho({
          aggregationMode: pxkMode,
          periodMonth: safeMonth,
          periodDate: ctx.periodDate,
        });
      }
      attachPxkSignatureExtraFields(monthly, { xuatTaiKho, diaDiem });
    }
    const hashPayload = {
      categoryKey,
      unitId,
      periodMonth: safeMonth,
      aggregationMode: mode,
      selectedUnitIds: normalizeMonthUnitIds(unitIds),
      lineIds: monthly.allLines.map((l) => ({
        id: l.id,
        qty: String(l.quantity),
        price: String(l.unitPrice),
        amount: String(l.amount),
      })),
      settings: resolveSettingsForSlips(monthly.allSlips),
    };
    return {
      context: monthly.rootContext,
      sourceDataHash: computeSourceDataHash(hashPayload),
    };
  }

  const d = String(periodDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new AppError({
      message: "periodDate phải dạng YYYY-MM-DD.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const slips = await loadSlipsForDate(unitId, d);
  const flatLines = slips.flatMap((s) => s.lines ?? []);
  const detailRows = flattenLinesFromSlips(slips);
  const total = sumAmount(flatLines);
  const context = buildContextBase({
    settings: resolveSettingsForSlips(slips),
    periodDate: d,
    detailRows,
    totalAmount: total,
    categoryKey: meta.key,
    extra: {
      slipCount: slips.length,
      lineCount: detailRows.length,
    },
  });
  await attachDocNumbersToContexts({
    contexts: [context],
    unitId,
    categoryKey: meta.key,
    periodMonth: d.slice(0, 7),
    aggregationMode: CHUNG_TU_AGGREGATION_MODES.BY_DAY,
    sheetKeyForContext: () => buildSheetKey({ kind: "by-day-bkmh", periodDate: d }),
  });
  const hashPayload = {
    categoryKey,
    unitId,
    periodDate: d,
    lineIds: flatLines.map((l) => ({
      id: l.id,
      qty: String(l.quantity),
      price: String(l.unitPrice),
      amount: String(l.amount),
    })),
    settings: resolveSettingsForSlips(slips),
  };
  return { context, sourceDataHash: computeSourceDataHash(hashPayload) };
}

export {
  aggregateLinesToDetailRows,
  aggregateSnapshotDetailRows,
  resolveDocumentNumberFields,
  resolveMonthlySheetContexts,
  resolvePnkFromBkmhSlices,
  resolvePnkFromBkmhSlices as resolvePnkMonthlyFromBkmhSlices,
};
