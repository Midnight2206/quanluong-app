import { getTargetUnitId } from "@/services/targetUnitScope";
import { RESOURCE_KIND } from "./ttlPolicy.js";
import { swrFetch } from "./swrFetch.js";

/**
 * Boot whitelist: current-user + LTTP commodities when target unit is set.
 * ponytail: skips commodities if no unitId (Task 9 may wire unit from user profile).
 * @param {{ db: import("dexie").Dexie; apiRequest: typeof import("@/services/apiRequest").apiRequest }} opts
 */
export async function prefetchBoot({ db, apiRequest }) {
  if (db == null) {
    return;
  }
  await swrFetch({
    db,
    url: "/auth/current-user",
    resourceKind: RESOURCE_KIND.profile,
    fetcher: () => apiRequest({ url: "/auth/current-user", method: "get" }),
  }).catch(() => {});

  const unitId = getTargetUnitId();
  if (unitId == null) {
    return;
  }
  await swrFetch({
    db,
    url: "/lttp/commodities",
    params: { unitId },
    resourceKind: RESOURCE_KIND.lttpCommodities,
    fetcher: () =>
      apiRequest({ url: "/lttp/commodities", method: "get", params: { unitId } }),
  }).catch(() => {});
}
