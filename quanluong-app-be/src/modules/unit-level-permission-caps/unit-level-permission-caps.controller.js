import { respondSuccess } from "../../shared/utils/responders.js";
import {
  getUnitLevelPermissionCapsByDepth,
  listUnitLevelPermissionCapsMatrix,
  replaceUnitLevelPermissionCapsForDepth,
} from "./unit-level-permission-caps.service.js";

async function listUnitLevelPermissionCapsController(_req, res) {
  const data = await listUnitLevelPermissionCapsMatrix();
  return respondSuccess(res, {
    message: "Fetched unit-level permission caps matrix",
    data,
  });
}

async function getUnitLevelPermissionCapsByDepthController(req, res) {
  const row = await getUnitLevelPermissionCapsByDepth(req.validatedParams.depth);
  return respondSuccess(res, {
    message: "Fetched unit-level permission caps for depth",
    data: row,
  });
}

async function replaceUnitLevelPermissionCapsController(req, res) {
  const row = await replaceUnitLevelPermissionCapsForDepth(
    req.validatedParams.depth,
    req.validatedBody.permissionIds,
  );
  return respondSuccess(res, {
    message: "Updated unit-level permission caps for depth",
    data: row,
  });
}

export {
  getUnitLevelPermissionCapsByDepthController,
  listUnitLevelPermissionCapsController,
  replaceUnitLevelPermissionCapsController,
};
