import { randomUUID } from "node:crypto";

const TTL_MS = 10 * 60 * 1000;
const MAX_GRANTS = 500;
const grants = new Map();

export function createToolGrant(fields) {
  if (grants.size >= MAX_GRANTS) {
    const oldest = grants.keys().next().value;
    grants.delete(oldest);
  }
  const id = randomUUID();
  grants.set(id, { ...fields, exp: Date.now() + TTL_MS });
  return id;
}

export function readToolGrant(id) {
  const row = grants.get(String(id || ""));
  if (!row) return null;
  if (row.exp < Date.now()) {
    grants.delete(String(id));
    return null;
  }
  return row;
}

export function clearToolGrants() {
  grants.clear();
}
