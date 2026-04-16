import "server-only";

import { serverApiFetch } from "@/lib/serverApiFetch";

/** @returns {Promise<{ ok: boolean, status: number, units: unknown[] }>} */
export async function fetchRegisterUnitsForServer() {
  const res = await serverApiFetch("/auth/register-units", {
    method: "GET",
    skipTargetUnitHeader: true,
    forwardCookies: false,
    next: { revalidate: 120 },
  });
  const status = res.status;
  if (!res.ok) {
    return { ok: false, status, units: [] };
  }
  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, status, units: [] };
  }
  if (!json || json.success !== true || !Array.isArray(json.data)) {
    return { ok: false, status, units: [] };
  }
  return { ok: true, status, units: json.data };
}
