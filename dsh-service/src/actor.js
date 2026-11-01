import { httpError } from "./http-error.js";

function clean(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 80 || /[/\\\r\n]/.test(text)) return "";
  return text;
}

export function requireActor(actor, args = {}) {
  const unitId = clean(actor?.unitId);
  const accountId = clean(actor?.accountId);
  if (!unitId || !accountId) throw httpError(403, "Missing unit context", "FORBIDDEN");
  if (args.unitId != null && String(args.unitId).trim() !== unitId) {
    throw httpError(403, "Unit mismatch", "FORBIDDEN");
  }
  if (args.accountId != null && String(args.accountId).trim() !== accountId) {
    throw httpError(403, "Account mismatch", "FORBIDDEN");
  }
  return {
    unitId,
    accountId,
    surface: actor.surface || "web",
    grantId: String(actor.grantId || ""),
    source: actor.source || "",
    assignment: actor.assignment || null,
  };
}
