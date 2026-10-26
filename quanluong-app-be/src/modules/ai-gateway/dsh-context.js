import { readAiEngine } from "./ai-engine.js";
import { createToolGrant } from "./grants.js";

export function dshCallFields(fields = {}) {
  if (readAiEngine() !== "dsh") return undefined;
  const feature = fields.feature || "unspecified";
  const grantId = createToolGrant({
    accountId: fields.accountId ?? "system",
    unitId: fields.unitId ?? 0,
    surface: fields.surface || "web",
    feature,
    scope: fields.scope || null,
    effectiveUnitIds: fields.effectiveUnitIds ?? null,
    dataScope: fields.dataScope || null,
  });
  return {
    accountId: fields.accountId ?? "system",
    unitId: fields.unitId ?? feature,
    surface: fields.surface || "web",
    feature,
    grantId,
  };
}
