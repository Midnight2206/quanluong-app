import { qk } from "@/app/query/queryKeys";

/** Invalidate toàn bộ query LTTP — tách file tránh import vòng. */
export function invalidateLttpData(qc) {
  qc.invalidateQueries({ queryKey: qk.lttp.root });
}
