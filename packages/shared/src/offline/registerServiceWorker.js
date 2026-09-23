/**
 * Serwist on apps/web sets `register: false` so SW registers only after login
 * (OfflineProvider). @serwist/next injects `window.serwist` via sw-entry on the client bundle.
 */
export async function registerOfflineServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const serwist = window.serwist;
  if (!serwist?.register) {
    return;
  }
  try {
    await serwist.register();
  } catch {
    // ponytail: fail-open if SW blocked or missing in dev (Serwist disabled)
  }
}
