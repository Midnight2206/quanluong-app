import { respondSuccess } from "../../shared/utils/responders.js";
import { recordUsageBatch } from "../../infra/audit/usage-audit.js";
import { listUsageDaily, listUsagePages, getDataChange, listAuthEvents, listDataChanges, listScopeUsers } from "./audit-logs.service.js";

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

async function listUsageController(req, res) {
  const data = await listUsageDaily(req.unitScope, req.validatedQuery);
  return respondSuccess(res, { message: "Fetched usage", data });
}

async function listUsagePagesController(req, res) {
  const data = await listUsagePages(req.unitScope, req.validatedQuery);
  return respondSuccess(res, { message: "Fetched usage pages", data });
}

async function usageBatchController(req, res) {
  const data = recordUsageBatch({ user: req.user, sessionId: req.session?.auth?.sessionId, events: req.validatedBody.events });
  return respondSuccess(res, { message: "Accepted", data });
}

export { listUsageController, listUsagePagesController, usageBatchController, getChangeController, listAuthController, listChangesController, listUsersController };
