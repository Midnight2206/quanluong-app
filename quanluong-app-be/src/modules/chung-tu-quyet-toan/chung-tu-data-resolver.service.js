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
import { attachCanCuBkmhToMonthlyContexts } from "./chung-tu-pnk-bkmh-basis.service.js";
import {
  attachRecipientUnitFillToMonthlyContexts,
  resolveRecipientUnitFillForSlip,
} from "./chung-tu-recipient-unit-fill.service.js";

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

function settingsWithSlipNguoiMua(settings, slips) {
  const fromSlips = resolveNguoiMuaFromSlips(slips);
  if (!fromSlips) return settings;
  return {
    ...settings,
    signerNguoiMua: fromSlips,
    hoTenNguoiMua: fromSlips,
    nguoiMua: fromSlips,
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
  const qty = Number(line.quantity);
  const requiredQty = Number(line.requiredQuantity);
  const unitPrice = Number(line.unitPrice);
  const amount = Number(line.amount);
  return {
    stt: index + 1,
    tenHang: line.commodity?.name ?? "",
    maSo: line.commodity?.code ?? "",
    dvt: line.commodity?.measureUnit ?? "",
    nguoiBan: line.lttpSupplier?.name ?? "",
    yeuCau: Number.isFinite(requiredQty) ? requiredQty : "",
    thucXuat: Number.isFinite(qty) ? qty : "",
    thucNhap: Number.isFinite(qty) ? qty : "",
    soLuong: Number.isFinite(qty) ? qty : "",
    donGia: Number.isFinite(unitPrice) ? formatVndNumber(unitPrice) : "",
    thanhTien: Number.isFinite(amount) ? formatVndNumber(amount) : "",
    ghiChu: String(line.lineNote ?? "").trim(),
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
  const code = String(line?.commodity?.code ?? "").trim();
  const name = String(line?.commodity?.name ?? "").trim();
  const unit = String(line?.commodity?.measureUnit ?? "").trim();
  return `fallback:${code}|${name}|${unit}`;
}

/** Gộp các dòng cùng hàng hóa trong một ngày: cộng số lượng và thành tiền. */
function aggregateLinesToDetailRows(rawLines) {
  const groups = new Map();
  for (const line of rawLines ?? []) {
    const key = commodityGroupKey(line);
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
        unitPrices: new Set(),
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
    const unitPrice = Number(line.unitPrice);
    if (Number.isFinite(unitPrice)) group.unitPrices.add(unitPrice);
    const supplierName = String(line.lttpSupplier?.name ?? "").trim();
    if (supplierName) group.supplierNames.add(supplierName);
    const lineNote = String(line.lineNote ?? "").trim();
    if (lineNote) group.lineNotes.add(lineNote);
  }

  return [...groups.values()].map((group, index) => {
    const qty = group.quantity;
    const amount = group.amount;
    let unitPrice = null;
    if (qty > 0 && amount > 0) {
      unitPrice = amount / qty;
    } else if (group.unitPrices.size === 1) {
      unitPrice = [...group.unitPrices][0];
    }
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
        quantity: qty,
        requiredQuantity: group.hasRequiredQuantity ? group.requiredQuantity : null,
        unitPrice,
        amount,
        lineNote: [...group.lineNotes].join("; "),
      },
      index,
    );
  });
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
  settings,
  categoryKey,
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
          settings: settingsWithSlipNguoiMua(settings, slips),
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
          settings: settingsWithSlipNguoiMua(settings, slips),
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
        settings: settingsWithSlipNguoiMua(settings, allSlips),
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
      settings: settingsWithSlipNguoiMua(settings, allSlipsCollected),
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
}) {
  const meta = assertKnownCategoryKey(categoryKey);
  const profile = await getChungTuUnitProfile({ unitId });
  const merged = mergeSettings(profile, settings);

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
    const slipSettings = {
      ...merged,
      donViSo: merged.donViSo || slip.printLine1 || slip.unit?.name || "",
      mauSo: merged.mauSo || slip.formMauSo || "",
      quyenSo: merged.quyenSo || slip.bookMmyy || "",
      soChungTu: merged.soChungTu || soPhieu,
      signerWriter: merged.signerWriter || slip.signerWriter || "",
      signerApprover: merged.signerApprover || slip.signerApprover || "",
      signerRecipient: slip.signerRecipient || slip.recipientDisplayName || slip.recipientUnit?.name || "",
      warehouseFrom: merged.warehouseFrom || slip.warehouseFrom || "",
      printLine1: slip.printLine1 || "",
      printLine2: slip.printLine2 || merged.printLine2 || "",
      ghiChu: merged.ghiChu || slip.note || "",
    };
    const context = buildContextBase({
      settings: slipSettings,
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
      settings: merged,
    };
    return { context, sourceDataHash: computeSourceDataHash(hashPayload) };
  }

  if (periodMonth) {
    const monthly = await resolveMonthlySheetContexts({
      periodMonth,
      unitIds,
      aggregationMode,
      settings: merged,
      categoryKey: meta.key,
    });
    if (meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO) {
      await attachCanCuBkmhToMonthlyContexts(monthly, {
        storageUnitId: unitId,
        periodMonth,
        aggregationMode,
      });
    }
    await attachRecipientUnitFillToMonthlyContexts(monthly, { aggregationMode });
    const hashPayload = {
      categoryKey,
      unitId,
      periodMonth: normalizePeriodMonth(periodMonth),
      aggregationMode: normalizeAggregationMode(aggregationMode),
      selectedUnitIds: normalizeMonthUnitIds(unitIds),
      lineIds: monthly.allLines.map((l) => ({
        id: l.id,
        qty: String(l.quantity),
        price: String(l.unitPrice),
        amount: String(l.amount),
      })),
      settings: merged,
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
    settings: merged,
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
    settings: merged,
  };
  return { context, sourceDataHash: computeSourceDataHash(hashPayload) };
}

export { aggregateLinesToDetailRows, resolveDocumentNumberFields, resolveMonthlySheetContexts };
