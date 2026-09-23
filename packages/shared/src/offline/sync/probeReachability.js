export const PROBE_BACKOFF_MS = [2000, 5000, 10000, 30000];

/**
 * @param {{
 *   getBrowserOnline: () => boolean;
 *   subscribeBrowser: (cb: (online: boolean) => void) => () => void;
 *   probe: () => Promise<boolean>;
 *   schedule?: (fn: () => void, ms: number) => () => void;
 * }} opts
 */
export function createReachabilityController({
  getBrowserOnline,
  subscribeBrowser,
  probe,
  schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
}) {
  /** @type {Set<(online: boolean) => void>} */
  const listeners = new Set();
  let appOnline = false;
  let probing = false;
  let retryIndex = 0;
  /** @type {(() => void) | null} */
  let cancelRetry = null;
  /** @type {(() => void) | null} */
  let unsubBrowser = null;
  let started = false;

  function emit() {
    for (const cb of listeners) cb(appOnline);
  }

  function setAppOnline(next) {
    if (next === appOnline) return;
    appOnline = next;
    emit();
  }

  function clearRetry() {
    cancelRetry?.();
    cancelRetry = null;
  }

  async function runProbe() {
    if (probing) return;
    if (!getBrowserOnline()) {
      clearRetry();
      setAppOnline(false);
      return;
    }
    probing = true;
    try {
      const ok = await probe();
      if (!getBrowserOnline()) {
        setAppOnline(false);
        return;
      }
      if (ok) {
        retryIndex = 0;
        clearRetry();
        setAppOnline(true);
        return;
      }
      setAppOnline(false);
      const wait = PROBE_BACKOFF_MS[Math.min(retryIndex, PROBE_BACKOFF_MS.length - 1)];
      retryIndex += 1;
      clearRetry();
      cancelRetry = schedule(() => {
        void runProbe();
      }, wait);
    } catch {
      setAppOnline(false);
      const wait = PROBE_BACKOFF_MS[Math.min(retryIndex, PROBE_BACKOFF_MS.length - 1)];
      retryIndex += 1;
      clearRetry();
      cancelRetry = schedule(() => {
        void runProbe();
      }, wait);
    } finally {
      probing = false;
    }
  }

  function onBrowser(online) {
    if (!online) {
      clearRetry();
      retryIndex = 0;
      setAppOnline(false);
      return;
    }
    void runProbe();
  }

  return {
    getOnline: () => appOnline,
    subscribe(cb) {
      listeners.add(cb);
      cb(appOnline);
      return () => listeners.delete(cb);
    },
    start() {
      if (started) return;
      started = true;
      unsubBrowser = subscribeBrowser(onBrowser);
      if (getBrowserOnline()) void runProbe();
    },
    stop() {
      started = false;
      clearRetry();
      unsubBrowser?.();
      unsubBrowser = null;
      setAppOnline(false);
    },
  };
}
