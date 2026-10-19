import { respondSuccess } from "../../shared/utils/responders.js";
import { getDataChange, listAuthEvents, listDataChanges, listScopeUsers } from "./audit-logs.service.js";

async function listAuthController(req, res) {
  const data = await listAuthEvents(req.unitScope, req.validatedQuery);
  return respondSuccess(res, { message: "Fetched auth logs", data });
}

async function listUsersController(req, res) {
  const data = await listScopeUsers(req.unitScope);
  return respondSuccess(res, { message: "Fetched users", data });
}

async function listChangesController(req, res) {
  const data = await listDataChanges(req.unitScope, req.validatedQuery);
  return respondSuccess(res, { message: "Fetched data changes", data });
}

async function getChangeController(req, res) {
  const data = await getDataChange(req.unitScope, req.validatedParams.id);
  return respondSuccess(res, { message: "Fetched data change", data });
}

export { getChangeController, listAuthController, listChangesController, listUsersController };
