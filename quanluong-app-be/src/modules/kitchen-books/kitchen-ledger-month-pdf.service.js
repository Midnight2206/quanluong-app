import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { getAuditContext } from "../../infra/audit/audit-context.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { loadUserSignatureDataUrl } from "../auth/signature.service.js";
import { LTTP_ISSUE_SLIP_SIGNATURE_IMAGE_LAYOUT } from "../lttp/lttp-issue-slip-signature-image-layout.js";
import { pickNguoiDuyetSlot } from "../lttp/lttp-issue-slip-signature-defaults.js";
import { getLttpIssueSlipSignatureSettings } from "../lttp/lttp-issue-slip-signature-settings.service.js";
import { renderKitchenLedgerBook } from "../../services/document-service.client.js";
import { buildMonthBook, countBookPages, daysInMonth } from "./kitchen-ledger-month-book.js";
import { getLedger } from "./kitchen-ledger.service.js";

function text(value) {
  return value == null ? "" : String(value).trim();
}

/** Cùng phiếu xuất: quản lý = rankAbbr + fullName của người in. */
function keeperName(profile) {
  const fullName = text(profile?.fullName);
  if (!fullName) return "";
  return [text(profile?.rankAbbr), fullName].filter(Boolean).join(" ");
}

/** Cùng phiếu xuất: chỉ huy = rankFull + fullName của người duyệt. */
async function approverName(userId, db) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) return "";
  const user = await db.user.findFirst({
    where: { id: uid, deletedAt: null },
    select: { username: true, profile: { select: { fullName: true, rankFull: true } } },
  });
  if (!user) return "";
  const fullName = text(user.profile?.fullName) || text(user.username);
  if (!fullName) return "";
  return [text(user.profile?.rankFull), fullName].filter(Boolean).join(" ");
}

async function resolveSignatures(unitId, user, scope, effectiveUnitIds, dataScope, deps) {
  const settings = await deps.getSignatureSettings({ unitId }, scope, effectiveUnitIds, dataScope);
  const slot = pickNguoiDuyetSlot(settings?.signatureBlock);
  const digital = slot?.useDigitalSignature !== false && slot?.approverUserId;
  const chiHuy = digital
    ? await deps.resolveApproverName(slot.approverUserId)
    : text(slot?.static_name);
  const chiHuyImage = digital ? await deps.loadSignature(slot.approverUserId) : null;
  const quanLyImage = user?.id ? await deps.loadSignature(user.id) : null;
  const signatureImages = {};
  if (quanLyImage) signatureImages.quan_ly = quanLyImage;
  if (chiHuyImage) signatureImages.chi_huy = chiHuyImage;
  const keeper = keeperName(user?.profile);
  return {
    commander: chiHuy,
    keeper,
    signatures: { quan_ly: keeper, truc_ban: "", chi_huy: chiHuy },
    signatureImages,
  };
}

async function exportLedgerMonthPdf(query, user, scope, effectiveUnitIds, dataScope, deps = {}) {
  const db = deps.prisma ?? prisma;
  const getLedgerFn = deps.getLedger ?? getLedger;
  const render = deps.render ?? renderKitchenLedgerBook;
  const month = String(query.month);
  const [year, monthNum] = month.split("-").map(Number);
  const unitId = Number(query.unitId);
  const last = daysInMonth(year, monthNum);
  const dayViews = [];
  for (let day = 1; day <= last; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    try {
      dayViews.push(await getLedgerFn({ unitId, date }, scope, effectiveUnitIds, dataScope));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        message: `Không lập được sổ ngày ${date}.`,
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        details: { date },
      });
    }
  }
  const signed = await resolveSignatures(unitId, user, scope, effectiveUnitIds, dataScope, {
    getSignatureSettings: deps.getSignatureSettings ?? getLttpIssueSlipSignatureSettings,
    resolveApproverName: deps.resolveApproverName ?? ((id) => approverName(id, db)),
    loadSignature: deps.loadSignature ?? loadUserSignatureDataUrl,
  });
  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { name: true } });
  const book = buildMonthBook({
    year,
    month: monthNum,
    unitName: unit?.name || "",
    dayViews,
    cover: { commander: signed.commander, keeper: signed.keeper },
    signatures: signed.signatures,
    signatureImages: signed.signatureImages,
    signatureImageLayout: LTTP_ISSUE_SLIP_SIGNATURE_IMAGE_LAYOUT,
  });
  const buffer = await render(book);
  const fileName = `So-nhap-xuat-LTTP-${month}.pdf`;
  const ctx = (deps.getAuditContext ?? getAuditContext)() || {};
  await db.dataChangeLog.create({
    data: {
      userId: user?.id ?? ctx.userId ?? null,
      unitId,
      action: "EXPORT",
      model: "KitchenLedgerMonth",
      recordId: `${unitId}:${month}`,
      changes: {
        month,
        draftDays: book.cover.draftDays,
        pageCount: countBookPages(book),
        fileName,
      },
      requestId: ctx.requestId ?? null,
      route: ctx.route ?? null,
      ip: ctx.ip ?? null,
    },
  });
  return { buffer, fileName, draftDays: book.cover.draftDays };
}

export { exportLedgerMonthPdf };
