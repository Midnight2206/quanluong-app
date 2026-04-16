import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import { mapUnit } from "./units.mapper.js";
import {
  createPrivateDataShares,
  createUnit,
  deactivateUnit,
  getUnitById,
  listPrivateDataShares,
  listUnits,
  patchUnit,
  revokePrivateDataShare,
} from "./units.service.js";

async function listUnitsController(req, res) {
  const units = await listUnits(req.unitScope, req.effectiveUnitIds);

  return respondSuccess(res, {
    message: "Fetched units successfully",
    data: units.map(mapUnit),
  });
}

async function getUnitDetailController(req, res) {
  const unit = await getUnitById(req.validatedParams.id, req.unitScope, req.effectiveUnitIds);

  return respondSuccess(res, {
    message: "Fetched unit successfully",
    data: mapUnit(unit),
  });
}

async function createUnitController(req, res) {
  const unit = await createUnit(req.validatedBody, req.unitScope, req.effectiveUnitIds);

  return respondCreated(res, {
    message: "Created unit successfully",
    data: mapUnit(unit),
  });
}

async function patchUnitController(req, res) {
  const unit = await patchUnit(req.validatedParams.id, req.validatedBody, req.unitScope, req.effectiveUnitIds);

  return respondSuccess(res, {
    message: "Updated unit successfully",
    data: mapUnit(unit),
  });
}

async function deleteUnitController(req, res) {
  const unit = await deactivateUnit(req.validatedParams.id, req.unitScope, req.effectiveUnitIds);

  return respondSuccess(res, {
    message: "Unit deactivated successfully",
    data: mapUnit(unit),
  });
}

async function listPrivateDataSharesController(req, res) {
  const rows = await listPrivateDataShares(
    req.validatedQuery.ownerUnitId,
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondSuccess(res, {
    message: "Đã tải danh sách gán chia sẻ",
    data: rows,
  });
}

async function createPrivateDataShareController(req, res) {
  const rows = await createPrivateDataShares(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondCreated(res, {
    message: "Đã tạo gán chia sẻ dữ liệu private",
    data: rows,
  });
}

async function revokePrivateDataShareController(req, res) {
  const row = await revokePrivateDataShare(
    req.validatedParams.grantId,
    req.unitScope,
    req.effectiveUnitIds,
  );
  return respondSuccess(res, {
    message: "Đã thu hồi gán chia sẻ",
    data: row,
  });
}

export {
  createPrivateDataShareController,
  createUnitController,
  deleteUnitController,
  getUnitDetailController,
  listPrivateDataSharesController,
  listUnitsController,
  patchUnitController,
  revokePrivateDataShareController,
};
