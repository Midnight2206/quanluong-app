import { respondSuccess } from "../../shared/utils/responders.js";
import { listPermissionsCatalog, patchPermissionDescription } from "./permissions.service.js";

async function listPermissionsController(_req, res) {
  const rows = await listPermissionsCatalog();
  return respondSuccess(res, {
    message: "Fetched permissions catalog",
    data: rows,
  });
}

async function patchPermissionController(req, res) {
  const row = await patchPermissionDescription(req.validatedParams.id, req.validatedBody);
  return respondSuccess(res, {
    message: "Permission updated",
    data: row,
  });
}

export { listPermissionsController, patchPermissionController };
