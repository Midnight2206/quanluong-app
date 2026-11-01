/** Tool sets per app surface. Session ids always include the surface.
 * Separate DSH processes are opt-in (DSH_SPLIT_PROFILES=1) because each
 * profile is a resident runtime. Default is one process with every tool,
 * and the backend grant decides which tool may run.
 */
export const SURFACE_FEATURES = {
  web: ["ledger", "menu", "issue-slip"],
  superadmin: [],
  supplier: ["issue-slip"],
};

export const SURFACES = Object.keys(SURFACE_FEATURES);
