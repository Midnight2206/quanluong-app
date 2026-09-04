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
import { formatVndNumber, vndToVietnameseDocumentLine } from "./chung-tu-vnd.util.js";
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
    // Empty profile must not blank unit-profile / legacy donViSo.
    resolved.donViCapTren = donViCapTren || resolved.donViCapTren;
    resolved.donVi = donVi || resolved.donVi;
    resolved.donViSo = donVi || resolved.donViSo;
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

function defaultBangKeSoChungTuFromParts(parts) {
  const quyenSo = defaultBookMmyyFromParts(parts);
  const dd = String(parts?.ngay ?? "").padStart(2, "0");
  if (!quyenSo || !parts?.ngay) return "";
  return `${quyenSo}${dd}`;
}

function resolveDocumentNumberFields({ settings, parts, categoryKey }) {
  if (categoryKey === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO) {
    const quyenSo =
      String(settings?.quyenSo ?? "").trim() || defaultBookMmyyFromParts(parts);
    const soChungTu = String(settings?.soChungTu ?? "").trim();
    return { quyenSo, soChungTu };
  }
  const quyenSo = defaultBookMmyyFromParts(parts);
  const soChungTu =
    categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG
      ? defaultBangKeSoChungTuFromParts(parts)
      : parts.ngay || "";
  return { quyenSo, soChungTu };
}

function mapLineRow(line, index) {
  const commodity = line?.commodity ?? null;
  const qty =
    toFiniteNumber(line?.quantity) ??
    toFiniteNumber(line?.soLuong) ??
    toFiniteNumber(line?.thucNhap) ??
    toFiniteNumber(line?.thucXuat);
  const requiredQty = toFiniteNumber(line?.requiredQuantity) ?? toFiniteNumber(line?.yeuCau);
  const unitPrice = toFiniteNumber(line?.unitPrice) ?? parseTongTien(line?.donGia);
  const amount = toFiniteNumber(line?.amount) ?? parseTongTien(line?.thanhTien);
  const supplierName = String(line?.nguoiBan ?? line?.lttpSupplier?.name ?? "").trim();
  const commodityId =
    toFiniteNumber(commodity?.id) ?? toFiniteNumber(line?.commodityId);
  return {
    stt: index + 1,
    tenHang: commodity?.name ?? line?.tenHang ?? "",
    maSo: commodity?.code ?? line?.maSo ?? "",
    dvt: commodity?.measureUnit ?? line?.dvt ?? "",
    nguoiBan: supplierName,
    yeuCau: Number.isFinite(requiredQty) ? requiredQty : "",
    thucXuat: Number.isFinite(qty) ? qty : "",
    thucNhap: Number.isFinite(qty) ? qty : "",
    soLuong: Number.isFinite(qty) ? qty : "",
    donGia: Number.isFinite(unitPrice) ? formatVndNumber(unitPrice) : "",
    thanhTien: Number.isFinite(amount) ? formatVndNumber(amount) : "",
    ghiChu: String(line?.lineNote ?? line?.ghiChu ?? "").trim(),
    commodityId: commodityId != null && commodityId > 0 ? commodityId : null,
    quantity: Number.isFinite(qty) ? qty : null,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
    amount: Number.isFinite(amount) ? amount : null,
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

function formatCanCuBkmhLineFromSlice(slice) {
  const so = String(slice?.soChungTu ?? "").trim() || "—";
  const periodDate = toIsoDateOnly(slice?.periodDate);
  if (!periodDate) return `Theo BKMH số: ${so}`;
  const { ngay, thang, nam } = ymdParts(periodDate);
  if (!ngay || !thang || !nam) return `Theo BKMH số: ${so}`;
  return `Theo BKMH số: ${so} ngày ${ngay} tháng ${thang} năm ${nam}`;
}

function formatCanCuBkmhTextFromSlices(slices) {
  const lines = [];
  const seen = new Set();
  for (const slice of slices ?? []) {
    const line = formatCanCuBkmhLineFromSlice(slice);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines.join("; ");
}

function noBkmhMonthlySourceError(periodMonth) {
  return new AppError({
    message: `Không có dữ liệu BKMH tháng ${periodMonth}. Vui lòng xuất BKMH trước khi xuất PNK.`,
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
  });
}

async function resolvePnkMonthlyFromBkmhSlices({
  storageUnitId,
  periodMonth,
  resolveSettingsForSlips,
}) {
  const safeMonth = normalizePeriodMonth(periodMonth);
  const monthly = await prisma.chungTuBkmhMonthly.findUnique({
    where: {
      storageUnitId_periodMonth: {
        storageUnitId: Number(storageUnitId),
        periodMonth: safeMonth,
      },
    },
    select: {
      id: true,
      unitIdsJson: true,
      slices: {
        select: {
          id: true,
          sortKey: true,
          soChungTu: true,
          periodDate: true,
          recipientUnitId: true,
          recipientUnitName: true,
          ngayThangNam: true,
          detailRowsJson: true,
        },
        orderBy: [{ sortKey: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!monthly?.slices?.length) {
    throw noBkmhMonthlySourceError(safeMonth);
  }

  const slicesByDate = new Map();
  const sourceSlices = [];
  const selectedUnitIds = normalizeMonthUnitIds(monthly.unitIdsJson);

  for (const slice of monthly.slices) {
    const periodDate = toIsoDateOnly(slice.periodDate);
    const detailRows = parseBkmhSliceDetailRowsJson(slice.detailRowsJson);
    if (!periodDate || !detailRows.length) continue;
    if (!slicesByDate.has(periodDate)) slicesByDate.set(periodDate, []);
    const item = { ...slice, periodDate, detailRows };
    slicesByDate.get(periodDate).push(item);
    sourceSlices.push(item);
  }

  if (!sourceSlices.length) {
    throw noBkmhMonthlySourceError(safeMonth);
  }

  const sheetContexts = [];
  let monthlyTotal = 0;
  for (const periodDate of [...slicesByDate.keys()].sort()) {
    const daySlices = slicesByDate.get(periodDate) ?? [];
    const detailRows = aggregateSnapshotDetailRows(daySlices.flatMap((slice) => slice.detailRows));
    if (!detailRows.length) continue;
    const totalAmount = sumAmount(detailRows);
    monthlyTotal += totalAmount;
    sheetContexts.push(
      buildContextBase({
        settings: resolveSettingsForSlips(),
        periodDate,
        detailRows,
        totalAmount,
        categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
        extra: {
          sheetName: periodDate.slice(-2),
          periodMonth: safeMonth,
          selectedUnitIds,
          aggregationMode: CHUNG_TU_AGGREGATION_MODES.BY_DAY,
          sliceCount: daySlices.length,
          lineCount: detailRows.length,
          canCuBkmh: formatCanCuBkmhTextFromSlices(daySlices),
        },
      }),
    );
  }

  if (!sheetContexts.length) {
    throw noBkmhMonthlySourceError(safeMonth);
  }

  return {
    sheetContexts,
    allLines: [],
    allSlips: [],
    sourceSlices,
    monthlyTotal,
    monthlySlipCount: sourceSlices.length,
    rootContext: buildContextBase({
      settings: resolveSettingsForSlips(),
      periodDate: `${safeMonth}-01`,
      detailRows: sheetContexts.flatMap((ctx) => ctx.detailRows ?? []),
      totalAmount: monthlyTotal,
      categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
      extra: {
        periodMonth: safeMonth,
        selectedUnitIds,
        aggregationMode: CHUNG_TU_AGGREGATION_MODES.BY_DAY,
        sheetContexts,
        sliceCount: sourceSlices.length,
        lineCount: sheetContexts.reduce((sum, ctx) => sum + (ctx.detailRows?.length ?? 0), 0),
        canCuBkmh: formatCanCuBkmhTextFromSlices(sourceSlices),
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
    for (const sheetName of sheetNames) {
      const day = `${safeMonth}-${sheetName}`;
      const slips = await loadSlipsForDateAcrossUnits(selectedUnitIds, day);
      allSlipsCollected.push(...slips);
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

export async function resolveChungTuContext({
  categoryKey,
  unitId,
  periodDate,
  periodMonth,
  issueSlipId,
  unitIds,
  aggregationMode,
  settings,
  exportingUserProfile,
  resolvedBkmhBuyer = null,
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
    const slipNoDisplay = String(slip.slipNo ?? "").padStart(4, "0");
    const soPhieu = slipNoDisplay;
    const baseSettings = resolveSettingsForSlips();
    const slipSettings = {
      ...baseSettings,
      donViSo: baseSettings.donViSo || slip.printLine1 || slip.unit?.name || "",
      mauSo: baseSettings.mauSo || slip.formMauSo || "",
      quyenSo: baseSettings.quyenSo || slip.bookMmyy || "",
      soChungTu: baseSettings.soChungTu || soPhieu,
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
        soPhieu,
        bookMmyy: slip.bookMmyy,
        slipNo: slip.slipNo,
        recipientUnitName: slip.recipientUnit?.name ?? "",
        recipientDisplayName: slip.recipientDisplayName ?? "",
        ...(await resolveRecipientUnitFillForSlip(slip)),
      },
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

  if (periodMonth) {
    const monthly =
      meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO
        ? await resolvePnkMonthlyFromBkmhSlices({
            storageUnitId: unitId,
            periodMonth,
            resolveSettingsForSlips,
          })
        : await resolveMonthlySheetContexts({
            periodMonth,
            unitIds,
            aggregationMode,
            categoryKey: meta.key,
            resolveSettingsForSlips,
          });
    await attachRecipientUnitFillToMonthlyContexts(monthly, { aggregationMode });
    const safeMonth = normalizePeriodMonth(periodMonth);
    const hashPayload =
      meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO
        ? {
            categoryKey,
            unitId,
            periodMonth: safeMonth,
            aggregationMode: CHUNG_TU_AGGREGATION_MODES.BY_DAY,
            selectedUnitIds: monthly.rootContext?.selectedUnitIds ?? [],
            sourceSlices: (monthly.sourceSlices ?? []).map((slice) => ({
              id: slice.id,
              sortKey: slice.sortKey,
              soChungTu: slice.soChungTu ?? "",
              periodDate: slice.periodDate,
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
          }
        : {
            categoryKey,
            unitId,
            periodMonth: safeMonth,
            aggregationMode: normalizeAggregationMode(aggregationMode),
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
  resolvePnkMonthlyFromBkmhSlices,
};
