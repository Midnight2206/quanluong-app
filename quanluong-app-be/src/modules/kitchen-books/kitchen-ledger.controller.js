import { respondSuccess } from "../../shared/utils/responders.js";
import {
  balanceLedger,
  getLedger,
  getLedgerSettings,
  lockLedger,
  saveLedger,
  saveLedgerSettings,
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

export {
  balanceLedgerController,
  getLedgerController,
  getLedgerSettingsController,
  lockLedgerController,
  saveLedgerController,
  saveLedgerSettingsController,
  unlockLedgerController,
};
