/**
 * SessionStorage helpers cho /lttp-nhap-xuat — không chứa bí mật, chỉ UI state.
 */

const KEYS = {
  manualUnitId: "quanluong:lttp:nhap-xuat:manual-unit-id",
  /** @param {number|string} unitId */
  draft: (unitId) => `quanluong:lttp:issue-slip-draft:v1:${unitId}`,
  /** @param {number|string} unitId — bộ lọc tab lịch sử theo từng kho */
  historyFilters: (unitId) => `quanluong:lttp:nhap-xuat:lich-su-filters:v1:${unitId}`,
};

function safeJsonParse(raw) {
  if (raw == null || typeof raw !== "string") {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readStoredManualUnitId() {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(KEYS.manualUnitId);
    if (raw == null || raw === "") {
      return null;
    }
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeStoredManualUnitId(unitId) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    if (unitId == null) {
      sessionStorage.removeItem(KEYS.manualUnitId);
      return;
    }
    sessionStorage.setItem(KEYS.manualUnitId, String(unitId));
  } catch {
    /* ignore quota */
  }
}

export function readIssueSlipDraft(unitId) {
  if (unitId == null || typeof sessionStorage === "undefined") {
    return null;
  }
  const o = safeJsonParse(sessionStorage.getItem(KEYS.draft(unitId)));
  if (!o || o.version !== 1 || Number(o.unitId) !== Number(unitId)) {
    return null;
  }
  return o;
}

export function writeIssueSlipDraft(unitId, payload) {
  if (unitId == null || typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(
      KEYS.draft(unitId),
      JSON.stringify({
        version: 1,
        unitId: Number(unitId),
        savedAt: new Date().toISOString(),
        ...payload,
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export function clearIssueSlipDraft(unitId) {
  if (unitId == null || typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(KEYS.draft(unitId));
  } catch {
    /* ignore */
  }
}

export function readLichSuFilters(unitId) {
  if (unitId == null || typeof sessionStorage === "undefined") {
    return null;
  }
  const o = safeJsonParse(sessionStorage.getItem(KEYS.historyFilters(unitId)));
  if (!o || o.version !== 1) {
    return null;
  }
  return o;
}

export function writeLichSuFilters(unitId, { listFrom, listTo, filterRecipientId, page }) {
  if (unitId == null || typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(
      KEYS.historyFilters(unitId),
      JSON.stringify({
        version: 1,
        unitId: Number(unitId),
        listFrom,
        listTo,
        filterRecipientId: filterRecipientId != null ? String(filterRecipientId) : "",
        page: Number(page) >= 1 ? Number(page) : 1,
      }),
    );
  } catch {
    /* ignore quota */
  }
}
