import { buildAuditExcel } from "./audit-logs.export.js";
import { authQuerySchema, changesQuerySchema, usageQuerySchema } from "./audit-logs.validator.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
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

const EXPORT_QUERY = { auth: authQuerySchema, changes: changesQuerySchema, usage: usageQuerySchema };

async function exportController(req, res) {
  const { tab } = req.validatedParams;
  const parsed = EXPORT_QUERY[tab].safeParse(req.query);
  if (!parsed.success) {
    throw new AppError({ message: "Invalid request data", statusCode: 400, code: ERROR_CODES.VALIDATION_ERROR });
  }
  const q = parsed.data;
  const { buffer } = await buildAuditExcel(tab, req.unitScope, q);
  const name = `nhat-ky-${tab}-${new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  return res.send(Buffer.from(buffer));
}

export { exportController, listUsageController, listUsagePagesController, usageBatchController, getChangeController, listAuthController, listChangesController, listUsersController };
