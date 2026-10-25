import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { mapLedgerRecords } from "../kitchen-books/kitchen-ledger-records.js";
import { readToolGrant } from "./grants.js";

const FEATURE_PREFIX = {
  ledger: ["kitchen-ledger", "ledger"],
  menu: ["kitchen-menu", "menu"],
  "issue-slip": ["lttp-issue-slip", "issue-slip"],
};

function fail(message, statusCode, code = ERROR_CODES.FORBIDDEN) {
  return new AppError({ message, statusCode, code });
}

function requireGrant(id, tool) {
  const grant = readToolGrant(id);
  if (!grant) throw fail("Grant hết hạn hoặc không đúng.", 403);
  const feature = String(grant.feature || "");
  const allowed = (FEATURE_PREFIX[tool] || []).some((prefix) => feature === prefix || feature.startsWith(`${prefix}-`) || feature.startsWith(prefix));
  if (!allowed) throw fail("Grant không mở công cụ này.", 403);
  if ((tool === "ledger" || tool === "menu") && !grant.scope) {
    throw fail("Grant không có phạm vi đơn vị.", 403);
  }
  return grant;
}

function trimLedger(view) {
  return {
    date: view?.date || "",
    headcountSaved: Boolean(view?.headcountSaved),
    headcount: view?.headcount || null,
    lines: (view?.lines || []).map((line) => ({
      name: line.name,
      qty: line.qty,
      kind: line.kind,
    })),
    movements: (view?.movements || []).map((row) => ({
      kind: row.kind,
      itemName: row.itemName,
      qty: row.qty,
    })),
  };
}

function trimMenu(view) {
  const periods = {};
  for (const [key, period] of Object.entries(view?.periods || {})) {
    periods[key] = {
      note: period?.note || "",
      dishes: (period?.dishes || []).map((dish) => ({ name: dish.name || dish.dishName || "" })),
    };
  }
  return { periods };
}

export async function readLedgerDay(body, deps = {}) {
  const grant = requireGrant(body.grantId, "ledger");
  const getLedger = deps.getLedger ?? (await import("../kitchen-books/kitchen-ledger.service.js")).getLedger;
  const view = await getLedger(
    { unitId: grant.unitId, date: body.date },
    grant.scope,
    grant.effectiveUnitIds,
    grant.dataScope,
  );
  return trimLedger(view);
}

export function proposeLedgerDraft(body, deps = {}) {
  requireGrant(body.grantId, "ledger");
  const map = deps.mapLedgerRecords ?? mapLedgerRecords;
  const raw = Array.isArray(body.records) ? { records: body.records } : body.batch;
  let mapped;
  try {
    mapped = map(raw, {
      anchorDate: body.date,
      settings: body.settings,
      commodities: body.commodities || [],
    });
  } catch (error) {
    throw fail(error?.message || "Bản ghi không đúng mẫu.", error?.statusCode || 422, ERROR_CODES.VALIDATION_ERROR);
  }
  return {
    draft: true,
    committed: false,
    lines: mapped.lines,
    proposals: mapped.proposals,
    questions: mapped.questions,
    notes: mapped.notes,
    headcountDays: mapped.headcountDays,
    warnings: mapped.headcountWarnings,
  };
}

export async function readMenuDay(body, deps = {}) {
  const grant = requireGrant(body.grantId, "menu");
  const getMenuDay = deps.getMenuDay ?? (await import("../kitchen-books/kitchen-books-menu.service.js")).getMenuDay;
  const view = await getMenuDay(
    { unitId: grant.unitId, date: body.date },
    grant.scope,
    grant.effectiveUnitIds,
    grant.dataScope,
  );
  return trimMenu(view);
}

export function proposeIssueSlipDraft(body) {
  requireGrant(body.grantId, "issue-slip");
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) throw fail("Chưa có dòng nháp.", 400, ERROR_CODES.VALIDATION_ERROR);
  return {
    draft: true,
    committed: false,
    lines: lines.slice(0, 80).map((line) => ({
      name: String(line?.name || "").slice(0, 255),
      qty: line?.qty,
      uom: line?.uom ? String(line.uom).slice(0, 64) : "",
    })),
  };
}
