const SURFACES = new Set(["web", "superadmin", "supplier"]);

export function normalizeSurface(value) {
  const surface = String(value || "web").trim().toLowerCase();
  return SURFACES.has(surface) ? surface : "web";
}

function safePart(value) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export class SessionStore {
  constructor() {
    this.rows = new Map();
  }

  open({ accountId, unitId, surface }) {
    const account = safePart(accountId);
    const unit = safePart(unitId);
    const face = normalizeSurface(surface);
    if (!account || !unit) {
      const error = new Error("accountId and unitId are required");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }
    const id = `session-acct-${account}-unit-${unit}-${face}`;
    const existing = this.rows.get(id);
    if (existing) return existing;
    const row = {
      id,
      accountId: String(accountId).trim(),
      unitId: String(unitId).trim(),
      surface: face,
      createdAt: new Date().toISOString(),
    };
    this.rows.set(id, row);
    return row;
  }

  get(id) {
    return this.rows.get(String(id || "")) || null;
  }

  assertOwner(row, body) {
    if (!row) {
      const error = new Error("Session not found");
      error.status = 404;
      error.code = "NOT_FOUND";
      throw error;
    }
    if (String(body.accountId).trim() !== row.accountId || String(body.unitId).trim() !== row.unitId) {
      const error = new Error("Session belongs to another account or unit");
      error.status = 403;
      error.code = "FORBIDDEN";
      throw error;
    }
    return row;
  }
}
