import crypto from "node:crypto";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  CHUNG_TU_CATEGORY_KEYS,
  assertKnownCategoryKey,
} from "./chung-tu-category.constants.js";
import { formatVndNumber, vndToVietnameseDocumentLine } from "./chung-tu-vnd.util.js";
import { getChungTuUnitProfile } from "./chung-tu-unit-profile.service.js";
import { buildMonthDaySheetNames, normalizeMonthUnitIds } from "./chung-tu-monthly-sheets.js";

const lineInclude = {
  commodity: { select: { id: true, code: true, name: true, measureUnit: true } },
  lttpSupplier: { select: { id: true, name: true } },
};

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

function mapLineRow(line, index) {
  const qty = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  const amount = Number(line.amount);
  return {
    stt: index + 1,
    tenHang: line.commodity?.name ?? "",
    maSo: line.commodity?.code ?? "",
    dvt: line.commodity?.measureUnit ?? "",
    nguoiBan: line.lttpSupplier?.name ?? "",
    soLuong: Number.isFinite(qty) ? qty : "",
    donGia: Number.isFinite(unitPrice) ? formatVndNumber(unitPrice) : "",
    thanhTien: Number.isFinite(amount) ? formatVndNumber(amount) : "",
    ghiChu: "",
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
    include: {
      lines: { include: lineInclude, orderBy: { id: "asc" } },
      recipientUnit: { select: { id: true, name: true } },
    },
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
    include: {
      lines: { include: lineInclude, orderBy: { id: "asc" } },
      recipientUnit: { select: { id: true, name: true } },
    },
    orderBy: [{ issueDate: "asc" }, { recipientUnitId: "asc" }, { slipNo: "asc" }, { id: "asc" }],
  });
}

async function loadSlipById(issueSlipId) {
  const slip = await prisma.lttpIssueSlip.findUnique({
    where: { id: issueSlipId },
    include: {
      lines: { include: lineInclude, orderBy: { id: "asc" } },
      recipientUnit: { select: { id: true, name: true } },
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

function flattenLinesFromSlips(slips) {
  const rows = [];
  for (const slip of slips) {
    for (const line of slip.lines ?? []) {
      rows.push(line);
    }
  }
  return rows.map(mapLineRow);
}

function sumAmount(lines) {
  let total = 0;
  for (const line of lines) {
    const n = Number(line.amount);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function buildContextBase({ settings, periodDate, detailRows, totalAmount, extra = {} }) {
  const parts = ymdParts(periodDate);
  const tongTien = totalAmount;
  const quyenSo = settings.quyenSo || defaultBookMmyyFromParts(parts);
  const soChungTu = settings.soChungTu || parts.ngay || "";
  return {
    ...settings,
    ...parts,
    ngayThangNam:
      parts.ngay && parts.thang && parts.nam
        ? `Ngày ${parts.ngay} tháng ${parts.thang} năm ${parts.nam}`
        : "",
    ngayChungTu: periodDate ?? "",
    quyenSo,
    soChungTu,
    so: soChungTu,
    tongTien: formatVndNumber(tongTien),
    tongTienSo: tongTien,
    tongTienBangChu: vndToVietnameseDocumentLine(tongTien),
    detailRows,
    ...extra,
  };
}

/** Alias fieldKey theo mẫu Bảng kê mua hàng (Named range trên Sheets). */
function applyBangKeMuaHangAliases(context) {
  return {
    ...context,
    donViCapMinh: context.donViSo ?? "",
    nguoiMua: context.signerNguoiMua ?? "",
    phuTrachBoPhan: context.signerPhuTrachBoPhan ?? "",
    taiChinh: context.signerTaiChinh ?? "",
    thuTruongDonVi: context.signerApprover ?? "",
  };
}

export function computeSourceDataHash(payload) {
  const raw = JSON.stringify(payload);
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

export async function resolveChungTuContext({
  categoryKey,
  unitId,
  periodDate,
  periodMonth,
  issueSlipId,
  unitIds,
  settings,
}) {
  const meta = assertKnownCategoryKey(categoryKey);
  const profile = await getChungTuUnitProfile({ unitId });
  const merged = mergeSettings(profile, settings);

  if (meta.key === CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO) {
    const slip = await loadSlipById(issueSlipId);
    if (Number(slip.unitId) !== Number(unitId)) {
      throw new AppError({
        message: "Phiếu xuất không thuộc đơn vị đã chọn.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const period = slip.issueDate.toISOString().slice(0, 10);
    const detailRows = (slip.lines ?? []).map(mapLineRow);
    const total = sumAmount(slip.lines ?? []);
    const slipNoDisplay = String(slip.slipNo ?? "").padStart(4, "0");
    const soPhieu = `${slip.bookMmyy}-${slipNoDisplay}`;
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
      extra: {
        issueSlipId: slip.id,
        soPhieu,
        bookMmyy: slip.bookMmyy,
        slipNo: slip.slipNo,
        recipientUnitName: slip.recipientUnit?.name ?? "",
        recipientDisplayName: slip.recipientDisplayName ?? "",
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

  if (meta.key === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG && periodMonth) {
    const selectedUnitIds = normalizeMonthUnitIds(unitIds);
    if (!selectedUnitIds.length) {
      throw new AppError({
        message: "Bảng kê mua hàng theo tháng cần chọn ít nhất một đơn vị.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const sheetNames = buildMonthDaySheetNames(periodMonth);
    const sheetContexts = [];
    const allLines = [];
    let monthlyTotal = 0;
    let monthlySlipCount = 0;

    for (const sheetName of sheetNames) {
      const day = `${periodMonth}-${sheetName}`;
      const slips = await loadSlipsForDateAcrossUnits(selectedUnitIds, day);
      const flatLines = slips.flatMap((s) => s.lines ?? []);
      const detailRows = flattenLinesFromSlips(slips);
      const total = sumAmount(flatLines);
      monthlyTotal += total;
      monthlySlipCount += slips.length;
      allLines.push(...flatLines);
      sheetContexts.push(
        applyBangKeMuaHangAliases(
          buildContextBase({
            settings: merged,
            periodDate: day,
            detailRows,
            totalAmount: total,
            extra: {
              sheetName,
              periodMonth,
              selectedUnitIds,
              slipCount: slips.length,
              lineCount: flatLines.length,
            },
          }),
        ),
      );
    }

    const context = applyBangKeMuaHangAliases(
      buildContextBase({
        settings: merged,
        periodDate: `${periodMonth}-01`,
        detailRows: sheetContexts.flatMap((ctx) => ctx.detailRows ?? []),
        totalAmount: monthlyTotal,
        extra: {
          periodMonth,
          selectedUnitIds,
          sheetContexts,
          slipCount: monthlySlipCount,
          lineCount: allLines.length,
        },
      }),
    );
    const hashPayload = {
      categoryKey,
      unitId,
      periodMonth,
      selectedUnitIds,
      lineIds: allLines.map((l) => ({
        id: l.id,
        qty: String(l.quantity),
        price: String(l.unitPrice),
        amount: String(l.amount),
      })),
      settings: merged,
    };
    return { context, sourceDataHash: computeSourceDataHash(hashPayload) };
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
  let context = buildContextBase({
    settings: merged,
    periodDate: d,
    detailRows,
    totalAmount: total,
    extra: {
      slipCount: slips.length,
      lineCount: flatLines.length,
    },
  });
  if (meta.key === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG) {
    context = applyBangKeMuaHangAliases(context);
  }
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
