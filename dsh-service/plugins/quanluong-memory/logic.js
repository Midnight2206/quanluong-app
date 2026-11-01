import { randomUUID } from "node:crypto";
import { httpError } from "../../src/http-error.js";
import { putUnit } from "../../src/json-doc.js";

export const UNIT_LIMIT = 2200;
export const USER_LIMIT = 1375;

export function redactText(text) {
  return String(text || "")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/MENU_AI_API_KEY\s*=\s*\S+/g, "MENU_AI_API_KEY=[redacted]")
    .replace(/DSH_SERVICE_TOKEN\s*=\s*\S+/g, "DSH_SERVICE_TOKEN=[redacted]")
    .replace(/OPENROUTER_API_KEY\s*=\s*\S+/g, "OPENROUTER_API_KEY=[redacted]");
}

function entriesOf(doc, unitId) {
  return [...(doc.units?.[String(unitId)]?.entries || [])];
}

function withEntries(doc, unitId, entries) {
  const current = doc.units?.[String(unitId)] || {};
  return putUnit(doc, unitId, { ...current, entries });
}

export function visibleEntries(doc, actor) {
  return entriesOf(doc, actor.unitId).filter((entry) => {
    if (entry.scope === "unit") return true;
    return entry.scope === "user" && entry.accountId === actor.accountId;
  });
}

function scoped(doc, actor, scope) {
  return visibleEntries(doc, actor).filter((entry) => entry.scope === scope);
}

function usedChars(doc, actor, scope) {
  return scoped(doc, actor, scope).reduce((sum, entry) => sum + entry.text.length, 0);
}

export function remember(doc, actor, input) {
  const scope = input.scope === "user" ? "user" : "unit";
  const text = redactText(input.text).trim().slice(0, 800);
  if (!text) throw httpError(400, "Memory text is empty", "BAD_MEMORY");
  const limit = scope === "user" ? USER_LIMIT : UNIT_LIMIT;
  const used = usedChars(doc, actor, scope);
  if (used + text.length > limit) {
    throw httpError(409, `Memory is full (${used}/${limit} chars). Remove an entry first.`, "MEMORY_FULL");
  }
  const row = {
    id: input.id || `mem_${randomUUID()}`,
    scope,
    accountId: actor.accountId,
    text,
    createdAt: input.now || new Date().toISOString(),
  };
  return { doc: withEntries(doc, actor.unitId, [...entriesOf(doc, actor.unitId), row]), entry: row };
}

export function searchMemory(doc, actor, query) {
  const tokens = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return visibleEntries(doc, actor)
    .map((entry) => ({
      id: entry.id,
      scope: entry.scope,
      text: entry.text,
      score: tokens.reduce((sum, token) => sum + (entry.text.toLowerCase().includes(token) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
}

export function summarizeMemory(doc, actor, scope) {
  const chosen = scope === "user" ? "user" : "unit";
  const limit = chosen === "user" ? USER_LIMIT : UNIT_LIMIT;
  const text = scoped(doc, actor, chosen).map((entry) => entry.text).join(" § ");
  return {
    scope: chosen,
    chars: text.length,
    limit,
    text: text.slice(0, limit),
    truncated: text.length > limit,
    persisted: false,
  };
}

export function forgetMemory(doc, actor, id) {
  const entries = entriesOf(doc, actor.unitId);
  const target = visibleEntries(doc, actor).find((entry) => entry.id === id);
  if (!target) throw httpError(404, "Memory not found", "NOT_FOUND");
  return {
    doc: withEntries(doc, actor.unitId, entries.filter((entry) => entry.id !== id)),
    entry: target,
  };
}
