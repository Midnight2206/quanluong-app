import { AsyncLocalStorage } from "node:async_hooks";

/** Ngữ cảnh request cho nhật ký: { requestId, ip, userAgent, route, userId, unitId, txBuffer }. */
const auditStorage = new AsyncLocalStorage();

function getAuditContext() {
  return auditStorage.getStore() ?? null;
}

function runWithAuditContext(ctx, fn) {
  return auditStorage.run(ctx, fn);
}

/** Middleware Express: mở ngữ cảnh cho mỗi request (user được gán sau ở authMiddleware). */
function auditContextMiddleware(req, _res, next) {
  const ctx = {
    requestId: req.requestId ?? null,
    ip: req.ip ?? null,
    route: `${req.method} ${req.originalUrl?.split("?")[0] ?? ""}`.slice(0, 128),
    userId: null,
    unitId: null,
  };
  auditStorage.run(ctx, () => next());
}

function setAuditActor(user) {
  const ctx = getAuditContext();
  if (ctx && user?.id) {
    ctx.userId = user.id;
    ctx.unitId = user.unitId ?? null;
  }
}

export { auditContextMiddleware, auditStorage, getAuditContext, runWithAuditContext, setAuditActor };
