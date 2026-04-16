import "server-only";

import { serverApiFetch } from "@/lib/serverApiFetch";

/** @returns {Promise<{ ok: boolean, status: number, users: unknown[] }>} */
export async function fetchUsersListForServer() {
  const res = await serverApiFetch("/users", { method: "GET" });
  const status = res.status;
  if (!res.ok) {
    return { ok: false, status, users: [] };
  }
  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, status, users: [] };
  }
  if (!json || json.success !== true || !Array.isArray(json.data)) {
    return { ok: false, status, users: [] };
  }
  return { ok: true, status, users: json.data };
}
