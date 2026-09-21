import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  getTemplateFields,
  renderDocumentPdf,
} from "../../services/document-service.client.js";
import { CHUNG_TU_CATEGORY_KEYS } from "../chung-tu-quyet-toan/chung-tu-category.constants.js";
import { buildDocumentServicePayload } from "../chung-tu-quyet-toan/chung-tu-pdf-map.util.js";
import { extractTemplateKeys } from "../chung-tu-quyet-toan/chung-tu-pdf-export.service.js";
import {
  formatViNumber,
  formatVndNumber,
  vndToVietnameseDocumentLine,
} from "../chung-tu-quyet-toan/chung-tu-vnd.util.js";
import { LTTP_ISSUE_SLIP_PRICE_KIND } from "./lttp.constants.js";
import {
  getDefaultLttpIssueSlipSignatureBlock,
  normalizeLttpIssueSlipExtraFields,
  normalizeLttpIssueSlipSignatureBlock,
} from "./lttp-issue-slip-signature-defaults.js";

const LTTP_PHIEU_XUAT_CATEGORY_KEY = CHUNG_TU_CATEGORY_KEYS.LTTP_PHIEU_XUAT;

function normalizeIssueSlipPriceKind(value) {
  return String(value ?? "").trim().toLowerCase() === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
    ? LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
    : LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
}

function resolveDisplayQuantities({ priceKind, quantity }) {
  const kind = normalizeIssueSlipPriceKind(priceKind);
  const raw =
    quantity !== "" && quantity != null && String(quantity).trim() !== ""
      ? quantity
      : null;
  if (raw == null) {
    return { quantityMarket: null, quantityTgsx: null };
  }
  if (kind === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX) {
    return { quantityMarket: null, quantityTgsx: raw };
  }
  return { quantityMarket: raw, quantityTgsx: null };
}

function formatIssueSlipPrintDate(ymd) {
  const m = String(ymd ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return "";
  return `Ngày ${String(d).padStart(2, "0")} tháng ${mo} năm ${y}`;
}

function formatQtyCell(value) {
  if (value == null || String(value).trim() === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return formatViNumber(n, { maxFractionDigits: 3 });
}

function resolveRecipientName(slip) {
  const dbDisplay = String(slip?.recipientDisplayName ?? "").trim();
  if (dbDisplay) return dbDisplay;
  const user = slip?.recipientUser;
  if (user) {
    const fn = user.fullName != null ? String(user.fullName).trim() : "";
    if (fn) return fn;
    const un = user.username != null ? String(user.username).trim() : "";
    if (un) return un;
  }
  const def = slip?.recipientNameFromUnitDefault;
  if (def != null && String(def).trim() !== "") return String(def).trim();
  return "";
}

function padSlipNo(slipNo) {
  if (slipNo == null || !Number.isFinite(Number(slipNo))) return "";
  return String(Number(slipNo)).padStart(4, "0");
}

function normalizeProfileText(value) {
  return value != null ? String(value).trim() : "";
}

/** NL_FIELD_don_vi* — always from exporting writer profile. */
function resolveWriterDonVi(exportingUserProfile) {
  const profile =
    exportingUserProfile && typeof exportingUserProfile === "object"
      ? exportingUserProfile
      : {};
  const donViCapTren = normalizeProfileText(profile.donViCapTren);
  const donVi = normalizeProfileText(profile.donVi);
  return { donViCapTren, donVi, printLine1: donViCapTren, printLine2: donVi };
}

/** Người viết phiếu (ký): rankAbbr + fullName từ hồ sơ user đang in/làm việc. */
function resolveWriterSignatureName(exportingUserProfile) {
  const profile =
    exportingUserProfile && typeof exportingUserProfile === "object"
      ? exportingUserProfile
      : {};
  const fullName = normalizeProfileText(profile.fullName);
  if (!fullName) return "";
  const rankAbbr = normalizeProfileText(profile.rankAbbr);
  return [rankAbbr, fullName].filter(Boolean).join(" ");
}

function pickStaticSlotName(signatureBlock, key) {
  const slots = Array.isArray(signatureBlock?.slots) ? signatureBlock.slots : [];
  const slot = slots.find((s) => String(s?.key ?? "") === key);
  if (!slot || slot.source !== "static") return "";
  return normalizeProfileText(slot.static_name);
}

/**
 * nguoi_viet_phieu / nguoi_nhan cố định (user đang làm việc / người nhận).
 * thu_kho / nguoi_duyet: slip override > settings static.
 */
function mergeIssueSlipSignatures(slip, signatureBlock, options = {}) {
  const recipientName = resolveRecipientName(slip);
  const writerName =
    resolveWriterSignatureName(options.exportingUserProfile) ||
    normalizeProfileText(slip?.signerWriter);
  const slipStorekeeper = normalizeProfileText(slip?.signerStorekeeper);
  const slipApprover = normalizeProfileText(slip?.signerApprover);
  return {
    nguoi_viet_phieu: writerName,
    thu_kho: slipStorekeeper || pickStaticSlotName(signatureBlock, "thu_kho"),
    nguoi_nhan: recipientName,
    nguoi_duyet: slipApprover || pickStaticSlotName(signatureBlock, "nguoi_duyet"),
  };
}

/**
 * @param {object} slip
 * @param {{ exportingUserProfile?: object | null, signatureSettings?: object | null }} [options]
 */
function buildLttpIssueSlipDocumentContext(slip, options = {}) {
  const issueDate = String(slip?.issueDate ?? "").slice(0, 10);
  const receivedDate = String(slip?.receivedDate ?? issueDate).slice(0, 10);
  const dateMatch = issueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ngay = dateMatch ? dateMatch[3] : "";
  const thang = dateMatch ? dateMatch[2] : "";
  const nam = dateMatch ? dateMatch[1] : "";
  const lines = Array.isArray(slip?.lines) ? slip.lines : [];
  const tongTienSo = lines.reduce((sum, line) => sum + (Number(line?.amount) || 0), 0);
  const soPhieu = padSlipNo(slip?.slipNo);
  const recipientName = resolveRecipientName(slip);
  const writerDonVi = resolveWriterDonVi(options.exportingUserProfile);
  const extras = normalizeLttpIssueSlipExtraFields(options.signatureSettings?.extraFields);
  const boPhan =
    normalizeProfileText(slip?.recipientUser?.department) ||
    normalizeProfileText(slip?.recipientUser?.profile?.department) ||
    "";

  const detailRows = lines.map((line, index) => {
    const commodity = line?.commodity ?? {};
    const unitPrice =
      line?.appliedUnitPrice != null && Number.isFinite(Number(line.appliedUnitPrice))
        ? Number(line.appliedUnitPrice)
        : Number(line?.unitPrice);
    const { quantityMarket, quantityTgsx } = resolveDisplayQuantities({
      priceKind: line?.priceKind,
      quantity: line?.quantity,
    });
    return {
      stt: index + 1,
      tenHang: commodity.name ?? "",
      maSo: commodity.code ?? "",
      dvt: commodity.measureUnit ?? "",
      muaTt: formatQtyCell(quantityMarket),
      tgsx: formatQtyCell(quantityTgsx),
      soLuong: formatQtyCell(line?.quantity),
      donGia: Number.isFinite(unitPrice) ? formatVndNumber(unitPrice) : "",
      thanhTien: formatVndNumber(line?.amount),
      ghiChu: line?.lineNote != null ? String(line.lineNote).trim() : "",
    };
  });

  return {
    categoryKey: LTTP_PHIEU_XUAT_CATEGORY_KEY,
    ngay,
    thang,
    nam,
    ngayThangNam: formatIssueSlipPrintDate(issueDate),
    ngayGiao: formatIssueSlipPrintDate(issueDate),
    ngayNhan: formatIssueSlipPrintDate(receivedDate),
    ...writerDonVi,
    formMauSo: slip?.formMauSo ?? "",
    quyenSo: slip?.bookMmyy ?? "",
    soChungTu: soPhieu,
    so: soPhieu,
    soPhieu,
    boPhan,
    lyDoSuDung: extras.lyDoSuDung,
    nguoiNhan: recipientName,
    nhanTaiKho: extras.nhanTaiKho,
    xuatTaiKho: extras.nhanTaiKho,
    nguoiVietPhieu: slip?.signerWriter ?? "",
    thuKho: slip?.signerStorekeeper ?? "",
    nguoiDuyet: slip?.signerApprover ?? "",
    signerRecipient: slip?.signerRecipient || recipientName,
    tongTien: formatVndNumber(tongTienSo),
    tongTienSo,
    tongTienBangChu: vndToVietnameseDocumentLine(tongTienSo),
    ghiChu: slip?.note ?? "",
    detailRows,
  };
}

async function loadSignatureSettingsForUnit(unitId) {
  if (unitId == null) {
    return {
      signatureBlock: getDefaultLttpIssueSlipSignatureBlock(),
      extraFields: normalizeLttpIssueSlipExtraFields({}),
    };
  }
  const row = await prisma.lttpIssueSlipSignatureSettings.findUnique({
    where: { unitId: Number(unitId) },
  });
  if (!row) {
    return {
      signatureBlock: getDefaultLttpIssueSlipSignatureBlock(),
      extraFields: normalizeLttpIssueSlipExtraFields({}),
    };
  }
  return {
    signatureBlock: normalizeLttpIssueSlipSignatureBlock(row.signatureBlockJson),
    extraFields: normalizeLttpIssueSlipExtraFields(row.extraFieldsJson),
  };
}

async function resolvePublishedLttpPhieuXuatTemplate() {
  const template = await prisma.chungTuPdfTemplate.findFirst({
    where: {
      categoryKey: LTTP_PHIEU_XUAT_CATEGORY_KEY,
      status: "published",
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  if (!template) {
    throw new AppError({
      message:
        "Chưa có mẫu PDF phiếu xuất LTTP (category lttp-phieu-xuat) đã publish. Hãy upload/publish mẫu trên document-service.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return template;
}

/**
 * @param {object} slip
 * @param {{ exportingUserProfile?: object | null }} [options]
 * @returns {Promise<{ buffer: Buffer, fileName: string }>}
 */
async function buildIssueSlipDocumentPdfBuffer(slip, options = {}) {
  const template = await resolvePublishedLttpPhieuXuatTemplate();
  const fieldsPayload = await getTemplateFields(template.documentServiceTemplateId);
  const { fieldKeys, columnKeys } = extractTemplateKeys(fieldsPayload);
  const fieldLabels =
    template.fieldLabelsJson &&
    typeof template.fieldLabelsJson === "object" &&
    !Array.isArray(template.fieldLabelsJson)
      ? Object.fromEntries(
          Object.entries(template.fieldLabelsJson).map(([key, value]) => [
            String(key),
            String(value ?? ""),
          ]),
        )
      : {};
  const signatureSettings = await loadSignatureSettingsForUnit(slip?.unitId);
  const context = buildLttpIssueSlipDocumentContext(slip, {
    ...options,
    signatureSettings,
  });
  const signatures = mergeIssueSlipSignatures(slip, signatureSettings.signatureBlock, options);
  const payload = buildDocumentServicePayload({
    categoryKey: LTTP_PHIEU_XUAT_CATEGORY_KEY,
    context,
    fieldKeys,
    columnKeys,
    fieldLabels,
    signatures,
    signatureBlock: signatureSettings.signatureBlock,
  });
  const buffer = await renderDocumentPdf(template.documentServiceTemplateId, payload);
  const safeBook = slip?.bookMmyy ? String(slip.bookMmyy) : "book";
  const safeNo = padSlipNo(slip?.slipNo) || "0000";
  return {
    buffer,
    fileName: `lttp-phieu-xuat-${safeBook}-${safeNo}.pdf`,
  };
}

export {
  LTTP_PHIEU_XUAT_CATEGORY_KEY,
  buildIssueSlipDocumentPdfBuffer,
  buildLttpIssueSlipDocumentContext,
  mergeIssueSlipSignatures,
  resolveWriterDonVi,
};
