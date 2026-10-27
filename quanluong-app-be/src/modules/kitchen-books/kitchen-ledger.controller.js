import { respondSuccess } from "../../shared/utils/responders.js";
import { exportLedgerMonthPdf } from "./kitchen-ledger-month-pdf.service.js";
import {
  balanceLedger,
  getLedger,
  getLedgerSettings,
  lockLedger,
  saveLedger,
  saveLedgerSettings,
  syncLedgerSlip,
  unlockLedger,
} from "./kitchen-ledger.service.js";

async function getLedgerController(req, res) {
  const data = await getLedger(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải sổ nhập xuất LTTP", data });
}

async function saveLedgerController(req, res) {
  const data = await saveLedger(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
    { userId: req.user?.id ?? null, source: "manual" },
  );
  return respondSuccess(res, { message: "Đã lưu sổ nhập xuất LTTP", data });
}

async function lockLedgerController(req, res) {
  const data = await lockLedger(
    req.validatedBody,
    req.user.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã chốt ngày", data });
}

async function unlockLedgerController(req, res) {
  const data = await unlockLedger(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
    { userId: req.user?.id ?? null },
  );
  return respondSuccess(res, { message: "Đã mở khóa ngày", data });
}

async function balanceLedgerController(req, res) {
  const data = await balanceLedger(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  const message = data.applied ? "Đã nhập dòng cân đối" : "Đề nghị cân đối";
  return respondSuccess(res, { message, data });
}

async function getLedgerSettingsController(req, res) {
  const data = await getLedgerSettings(
    req.validatedQuery,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã tải cấu hình sổ", data });
}

async function saveLedgerSettingsController(req, res) {
  const data = await saveLedgerSettings(
    req.validatedBody,
    req.user.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã lưu cấu hình sổ", data });
}

async function syncLedgerSlipController(req, res) {
  const data = await syncLedgerSlip(
    req.validatedBody,
    req.user.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, { message: "Đã ghi phiếu xuất từ khung sổ", data });
}

async function exportLedgerMonthPdfController(req, res) {
  const { buffer, fileName, draftDays } = await exportLedgerMonthPdf(
    req.validatedQuery,
    req.user,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  if (draftDays.length) res.setHeader("X-Ledger-Draft-Days", draftDays.join(","));
  res.send(buffer);
}

export {
  balanceLedgerController,
  exportLedgerMonthPdfController,
  getLedgerController,
  getLedgerSettingsController,
  lockLedgerController,
  saveLedgerController,
  saveLedgerSettingsController,
  syncLedgerSlipController,
  unlockLedgerController,
};
