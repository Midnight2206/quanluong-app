import { respondSuccess } from "../../shared/utils/responders.js";
import { listAuthEvents, listScopeUsers } from "./audit-logs.service.js";

async function listAuthController(req, res) {
  const data = await listAuthEvents(req.unitScope, req.validatedQuery);
  return respondSuccess(res, { message: "Fetched auth logs", data });
}

async function listUsersController(req, res) {
  const data = await listScopeUsers(req.unitScope);
  return respondSuccess(res, { message: "Fetched users", data });
}

export { listAuthController, listUsersController };
